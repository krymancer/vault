const std = @import("std");
const os = std.os.linux;
const crypto = std.crypto;
const posix = std.posix;
const Aes256Gcm = crypto.aead.aes_gcm.Aes256Gcm;

const gf = @import("galois.zig");

var master_key = [_]u8{0} ** 32;
var key_hash: [32]u8 = [_]u8{0} ** 32;
var is_unsealed = false;

export fn vault_lock_memory() i32 {
    const address = @intFromPtr(&master_key);

    var result = os.mlock(@ptrFromInt(address), 32);
    if (result != 0) return -1;

    result = os.madvise(@ptrFromInt(address), 32, os.MADV.DONTDUMP);
    if (result != 0) return -2;

    return 0;
}

export fn vault_is_open() bool {
    return is_unsealed;
}

fn reconstruct_secret(x_coords: []const u8, y_coords: []const u8) u8 {
    var secret: u8 = 0;
    const n = x_coords.len;

    for (0..n) |i| {
        var li: u8 = 1;
        for (0..n) |j| {
            if (i == j) continue;
            // li = li * (0 - xj) / (xi - xj)
            const num = x_coords[j];
            const den = gf.add(x_coords[i], x_coords[j]);
            li = gf.multipy(li, gf.divide(num, den));
        }
        secret = gf.add(secret, gf.multipy(y_coords[i], li));
    }
    return secret;
}

export fn unseal(input_shards: [*]const u8, t: u8, stored_hash: [*]const u8) i32 {
    var reconstructed: [32]u8 = undefined;

    var x_vec: [255]u8 = undefined;
    var y_vec: [255]u8 = undefined;

    for (0..32) |byte_idx| {
        for (0..t) |shard_idx| {
            const offset = shard_idx * 33;
            x_vec[shard_idx] = input_shards[offset];
            y_vec[shard_idx] = input_shards[offset + 1 + byte_idx];
        }
        reconstructed[byte_idx] = reconstruct_secret(x_vec[0..t], y_vec[0..t]);
    }

    var trial_hash: [32]u8 = undefined;
    crypto.hash.sha2.Sha256.hash(&reconstructed, &trial_hash, .{});

    if (!std.mem.eql(u8, &trial_hash, stored_hash[0..32])) {
        @memset(&reconstructed, 0);
        return -1;
    }

    @memcpy(&master_key, &reconstructed);
    is_unsealed = true;

    @memset(&reconstructed, 0);
    return 0;
}

export fn init(
    count: u8,
    threshold: u8,
    buffer_ptr: [*]u8,
    hash_ptr: [*]u8,
) i32 {
    if (threshold > count or threshold < 2) return -1;

    var temp_key: [32]u8 = undefined;
    posix.getrandom(&temp_key) catch return -2;
    crypto.hash.sha2.Sha256.hash(&temp_key, hash_ptr[0..32], .{});

    var s_idx: u8 = 0;
    while (s_idx < count) : (s_idx += 1) {
        const x = s_idx + 1;
        const offset = @as(usize, s_idx) * 33;
        buffer_ptr[offset] = x;
    }

    for (temp_key, 0..) |m_byte, b_idx| {
        var coeffs: [255]u8 = undefined;
        coeffs[0] = m_byte;
        posix.getrandom(coeffs[1..threshold]) catch return -2;

        s_idx = 0;
        while (s_idx < count) : (s_idx += 1) {
            const x = s_idx + 1;
            const offset = @as(usize, s_idx) * 33;
            const y = gf.evaluate(coeffs[0..threshold], x);
            buffer_ptr[offset + 1 + b_idx] = y;
        }
    }

    @memset(&temp_key, 0);
    return 0;
}

export fn encrypt(plaintext: [*]const u8, plaintext_len: usize, out_ptr: [*]u8) i32 {
    if (!is_unsealed) return -1;

    const nonce_len = Aes256Gcm.nonce_length;
    const tag_len = Aes256Gcm.tag_length;

    var nonce: [nonce_len]u8 = undefined;
    posix.getrandom(&nonce) catch return -2;

    var tag: [tag_len]u8 = undefined;
    const ciphertext = out_ptr[nonce_len .. nonce_len + plaintext_len];

    Aes256Gcm.encrypt(ciphertext, &tag, plaintext[0..plaintext_len], "", nonce, master_key);

    @memcpy(out_ptr[0..nonce_len], &nonce);
    @memcpy(out_ptr[nonce_len + plaintext_len .. nonce_len + plaintext_len + tag_len], &tag);

    return 0;
}

export fn decrypt(input_ptr: [*]const u8, ciphertext_len: usize, out_ptr: [*]u8) i32 {
    if (!is_unsealed) return -1;

    const nonce_len = Aes256Gcm.nonce_length;
    const tag_len = Aes256Gcm.tag_length;

    if (ciphertext_len < nonce_len + tag_len) return -2;

    const plaintext_len = ciphertext_len - nonce_len - tag_len;
    var nonce: [nonce_len]u8 = undefined;
    @memcpy(&nonce, input_ptr[0..nonce_len]);

    const ciphertext = input_ptr[nonce_len .. nonce_len + plaintext_len];
    var tag: [tag_len]u8 = undefined;
    @memcpy(&tag, input_ptr[nonce_len + plaintext_len .. nonce_len + plaintext_len + tag_len]);

    Aes256Gcm.decrypt(out_ptr[0..plaintext_len], ciphertext, tag, "", nonce, master_key) catch return -3;

    return 0;
}

test "Vault Roundtrip: Init -> Unseal" {
    const n: u8 = 5;
    const t: u8 = 3;

    var shards = [_]u8{0} ** (5 * 33);
    var hash = [_]u8{0} ** 32;

    const init_res = init(n, t, &shards, &hash);
    try std.testing.expectEqual(@as(i32, 0), init_res);

    // Test with first t shards
    const unseal_res = unseal(&shards, t, &hash);
    try std.testing.expectEqual(@as(i32, 0), unseal_res);
    try std.testing.expect(vault_is_open());
    is_unsealed = false; // Reset for next test

    // Test with last t shards
    const last_shards = shards[2 * 33 .. 5 * 33];
    const unseal_res_2 = unseal(last_shards.ptr, t, &hash);
    try std.testing.expectEqual(@as(i32, 0), unseal_res_2);
    try std.testing.expect(vault_is_open());
    is_unsealed = false;

    // Test with fewer than t shards
    const unseal_res_3 = unseal(&shards, t - 1, &hash);
    try std.testing.expectEqual(@as(i32, -1), unseal_res_3);
    try std.testing.expect(!vault_is_open());
}

test "Encryption Roundtrip" {
    const n: u8 = 5;
    const t: u8 = 3;
    var shards = [_]u8{0} ** (5 * 33);
    var hash = [_]u8{0} ** 32;

    _ = init(n, t, &shards, &hash);
    _ = unseal(&shards, t, &hash);

    const msg = "Secret Message 123";
    var encrypted: [12 + 18 + 16]u8 = undefined;
    var decrypted: [18]u8 = undefined;

    const enc_res = encrypt(msg.ptr, msg.len, &encrypted);
    try std.testing.expectEqual(@as(i32, 0), enc_res);

    const dec_res = decrypt(&encrypted, encrypted.len, &decrypted);
    try std.testing.expectEqual(@as(i32, 0), dec_res);
    try std.testing.expectEqualSlices(u8, msg, &decrypted);
}
