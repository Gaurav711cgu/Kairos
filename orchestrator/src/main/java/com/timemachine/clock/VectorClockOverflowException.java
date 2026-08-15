package com.timemachine.clock;

public class VectorClockOverflowException extends RuntimeException {
    public VectorClockOverflowException(String message) {
        super(message);
    }
}
