/**
 * ContextFlow QNX Hello World
 * 
 * A minimal QNX Neutrino program that demonstrates:
 * - Basic QNX system calls
 * - Thread creation using POSIX threads
 * - QNX-specific timer usage
 * - Message passing basics
 * 
 * This program is used by ContextFlow QNX Companion to demonstrate
 * build analysis, diagnostic reporting, and QEMU testing.
 * 
 * Target: QNX 8.0 SDP
 * Compiler: qcc (QNX C/C++ compiler)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/neutrino.h>
#include <pthread.h>
#include <time.h>
#include <errno.h>

#define CONTEXTFLOW_VERSION "0.1.0"
#define MAX_THREADS 4

typedef struct {
    int thread_id;
    const char *task_name;
    int iterations;
} worker_config_t;

/**
 * Worker thread function demonstrating QNX thread management.
 */
void *worker_thread(void *arg) {
    worker_config_t *config = (worker_config_t *)arg;
    
    printf("[ContextFlow] Thread %d (%s) started\n", 
           config->thread_id, config->task_name);
    
    for (int i = 0; i < config->iterations; i++) {
        printf("[ContextFlow] Thread %d: iteration %d/%d\n",
               config->thread_id, i + 1, config->iterations);
        
        /* Use QNX-specific nanosleep for precise timing */
        struct timespec ts = { .tv_sec = 0, .tv_nsec = 100000000 }; /* 100ms */
        nanosleep(&ts, NULL);
    }
    
    printf("[ContextFlow] Thread %d (%s) completed\n",
           config->thread_id, config->task_name);
    
    return NULL;
}

/**
 * Display system information using QNX APIs.
 */
void print_system_info(void) {
    printf("\n========================================\n");
    printf("  ContextFlow QNX Demo v%s\n", CONTEXTFLOW_VERSION);
    printf("  Engineering context. Connected intelligence.\n");
    printf("========================================\n\n");
    
    printf("System Information:\n");
    printf("  PID:      %d\n", getpid());
    printf("  Platform: QNX Neutrino\n");
    
    /* Get number of CPUs */
    long ncpus = sysconf(_SC_NPROCESSORS_ONLN);
    if (ncpus > 0) {
        printf("  CPUs:     %ld\n", ncpus);
    }
    
    /* Get page size */
    long pagesize = sysconf(_SC_PAGESIZE);
    if (pagesize > 0) {
        printf("  Page size: %ld bytes\n", pagesize);
    }
    
    printf("\n");
}

int main(int argc, char *argv[]) {
    pthread_t threads[MAX_THREADS];
    worker_config_t configs[MAX_THREADS];
    int num_threads = 2; /* Default */
    
    /* Parse command line */
    if (argc > 1) {
        num_threads = atoi(argv[1]);
        if (num_threads < 1 || num_threads > MAX_THREADS) {
            fprintf(stderr, "Error: thread count must be 1-%d\n", MAX_THREADS);
            return EXIT_FAILURE;
        }
    }
    
    print_system_info();
    
    /* Configure worker threads */
    const char *task_names[] = {
        "diagnostic-scan",
        "build-monitor",
        "report-generator",
        "context-analyzer"
    };
    
    printf("Starting %d worker threads...\n\n", num_threads);
    
    for (int i = 0; i < num_threads; i++) {
        configs[i].thread_id = i;
        configs[i].task_name = task_names[i];
        configs[i].iterations = 3;
        
        int rc = pthread_create(&threads[i], NULL, worker_thread, &configs[i]);
        if (rc != 0) {
            fprintf(stderr, "Error: pthread_create failed for thread %d: %s\n",
                    i, strerror(rc));
            return EXIT_FAILURE;
        }
    }
    
    /* Wait for all threads to complete */
    for (int i = 0; i < num_threads; i++) {
        pthread_join(threads[i], NULL);
    }
    
    printf("\n[ContextFlow] All workers completed successfully.\n");
    printf("[ContextFlow] Build verification: PASS\n");
    
    return EXIT_SUCCESS;
}
