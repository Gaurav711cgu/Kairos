package com.timemachine.replay;

public record NeonBranch(String id, String connectionString) {

    // Alias accessors for consistent naming across DbRestorer and NeonBranchManager
    public String branchId() {
        return id;
    }

    public String connectionUri() {
        return connectionString;
    }
}
