using System.Runtime.InteropServices;

namespace Api;

enum VaultStatus
{
  Operational = 1,
  Closed = 0
}

internal static partial class VaultLibrary
{
  [LibraryImport("libvault.so", EntryPoint = "check_core_status")]
  public static partial int CheckStatus();
}