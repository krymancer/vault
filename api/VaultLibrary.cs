using System.Runtime.InteropServices;

namespace Api;

enum VaultStatus
{
  Operational = 1,
  Closed = 0
}

internal static partial class VaultLibrary
{
  [LibraryImport("libvault.so", EntryPoint = "vault_is_open")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  [return: MarshalAs(UnmanagedType.I1)]
  public static partial bool IsOpen();

  [LibraryImport("libvault.so", EntryPoint = "init")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int Init(byte count, byte threshold, byte* buffer, byte* hash);

  [LibraryImport("libvault.so", EntryPoint = "unseal")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int Unseal(byte* shards, byte threshold, byte* hash);

  [LibraryImport("libvault.so", EntryPoint = "encrypt")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int Encrypt(byte* plaintext, nuint plaintextLen, byte* output);

  [LibraryImport("libvault.so", EntryPoint = "decrypt")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int Decrypt(byte* input, nuint inputLen, byte* output);

  [LibraryImport("libvault.so", EntryPoint = "hmac")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int Hmac(byte* input, nuint inputLen, byte* output);

  [LibraryImport("libvault.so", EntryPoint = "hmac_verify")]
  [UnmanagedCallConv(CallConvs = [typeof(System.Runtime.CompilerServices.CallConvCdecl)])]
  public static unsafe partial int HmacVerify(byte* input, nuint inputLen, byte* expected);
}