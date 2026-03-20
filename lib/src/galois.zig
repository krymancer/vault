const std = @import("std");

pub fn add(a: u8, b: u8) u8 {
    return a ^ b;
}

pub fn multipy(a: u8, b: u8) u8 {
    var res: u8 = 0;
    var va = a;
    var vb = b;
    while (vb > 0) : (vb >>= 1) {
        if (vb & 1 > 0) res ^= va;
        const high_bit = va & 0x80;
        va <<= 1;
        if (high_bit > 0) va ^= 0x1B;
    }
    return res;
}

pub fn divide(a: u8, b: u8) u8 {
    if (b == 0) @panic("Divisão por zero em GF256");
    if (a == 0) return 0;

    var i: u16 = 1;
    while (i < 256) : (i += 1) {
        const v: u8 = @intCast(i);
        if (multipy(b, v) == 1) return multipy(a, v);
    }
    return 0;
}

/// f(x) = c0 + c1*x + c2*x^2...
pub fn evaluate(coeffs: []const u8, x: u8) u8 {
    var result: u8 = 0;
    var x_pow: u8 = 1;
    for (coeffs) |c| {
        result = add(result, multipy(c, x_pow));
        x_pow = multipy(x_pow, x);
    }
    return result;
}

test "GF256 Addition" {
    try std.testing.expectEqual(@as(u8, 0), add(5, 5));
    try std.testing.expectEqual(@as(u8, 3), add(1, 2));
}

test "GF256 Multiplication" {
    // 0x53 * 0xCA = 0x01 in AES field (common test case)
    try std.testing.expectEqual(@as(u8, 1), multipy(0x53, 0xCA));
    // Identity
    try std.testing.expectEqual(@as(u8, 42), multipy(42, 1));
    // Zero
    try std.testing.expectEqual(@as(u8, 0), multipy(42, 0));
}

test "GF256 Commutativity" {
    const a: u8 = 123;
    const b: u8 = 45;
    try std.testing.expectEqual(multipy(a, b), multipy(b, a));
}

test "GF256 Distributivity" {
    const a: u8 = 7;
    const b: u8 = 13;
    const c: u8 = 21;
    // a * (b + c) == a * b + a * c
    const left = multipy(a, add(b, c));
    const right = add(multipy(a, b), multipy(a, c));
    try std.testing.expectEqual(left, right);
}

test "GF256 Inverse" {
    var i: u16 = 1;
    while (i < 256) : (i += 1) {
        const a: u8 = @intCast(i);
        const inv_a = divide(1, a);
        try std.testing.expectEqual(@as(u8, 1), multipy(a, inv_a));
    }
}

test "GF256 Evaluate" {
    const coeffs = [_]u8{ 10, 20, 30 }; // f(x) = 10 + 20x + 30x^2
    // f(0) = 10
    try std.testing.expectEqual(@as(u8, 10), evaluate(&coeffs, 0));
    // f(1) = 10 ^ 20 ^ 30 = 30 ^ 30 = 0
    try std.testing.expectEqual(@as(u8, 0), evaluate(&coeffs, 1));
}

