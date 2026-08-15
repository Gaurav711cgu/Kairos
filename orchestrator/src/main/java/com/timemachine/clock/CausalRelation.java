package com.timemachine.clock;

public enum CausalRelation {
    HAPPENS_BEFORE,   // this -> other (this causally precedes other)
    HAPPENS_AFTER,    // other -> this (this causally follows other)
    CONCURRENT        // neither dominates (events are causally independent)
}
