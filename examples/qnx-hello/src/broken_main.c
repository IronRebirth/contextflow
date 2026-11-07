/**
 * ContextFlow QNX Demo - INTENTIONALLY BROKEN
 * 
 * This file contains deliberate errors to demonstrate ContextFlow's
 * build diagnostic analysis capabilities.
 * 
 * Errors included:
 * 1. Missing include for sys/neutrino.h
 * 2. Undeclared variable usage
 * 3. Type mismatch
 * 4. Missing semicolon
 * 5. QNX-specific API misuse
 */

#include <stdio.h>
#include <stdlib.h>
/* Deliberately missing: #include <sys/neutrino.h> */
/* Deliberately missing: #include <pthread.h> */

#define MAX_THREADS 4

int main(int argc, char *argv[]) {
    /* Error 1: undeclared_var not defined */
    printf("Thread count: %d\n", undeclared_var);
    
    /* Error 2: Type mismatch - assigning string to int */
    int thread_count = "four";
    
    /* Error 3: Missing semicolon */
    printf("Starting workers...\n")
    
    /* Error 4: Using QNX API without include */
    pthread_t thread;
    pthread_create(&thread, NULL, NULL, NULL);
    
    /* Error 5: Wrong number of arguments to ChannelCreate */
    int chid = ChannelCreate(1, 2, 3, 4, 5);
    
    return EXIT_SUCCESS;
}
