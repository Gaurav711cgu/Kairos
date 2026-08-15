package com.timemachine.store;
public record CausalOrderEntry(String snapshotId, int causalPosition) {}
