package com.timemachine.replay;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class NeonBranchManager {
    @Value("${neon.api-key:}")
    private String apiKey;
    
    @Value("${neon.project-id:}")
    private String projectId;
    
    public NeonBranch createBranch(String name) {
        return new NeonBranch("branch123", "jdbc:postgresql://neon...");
    }
    
    public void deleteBranch(String branchId) { }
    
    public void applyIncremental(String connectionString, String snapshotId) { }
}
