//! Vault lib

const std = @import("std");

pub const core_status = enum(u32) {
    operational = 1,
    closed = 0,
};

/// Check if the vault is closed or operational
export fn check_core_status() core_status {
    return .operational;
}
