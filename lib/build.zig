const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});

    const optimize = b.standardOptimizeOption(.{});

    const lib = b.addLibrary(.{
        .name = "vault",
        .linkage = .dynamic,
        .version = .{
            .major = 0,
            .minor = 0,
            .patch = 1,
        },
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/root.zig"),
            .optimize = optimize,
            .target = target,
        }),
    });

    b.installArtifact(lib);
}
