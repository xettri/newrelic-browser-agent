export { insertSupportMetrics };    // export list

/**
 * True for each Worker type supported in browser's execution context. Not all browser versions may support certain Workers or options however.
 * - Warning: service workers are not available on unsecured HTTP sites
 */
const workersApiIsSupported = {
    dedicated: Boolean(self.Worker),
    shared: Boolean(self.SharedWorker),
    service: Boolean(self.navigator?.serviceWorker)
};

let origWorker, origSharedWorker, origServiceWorkerCreate;
/**
 * Un-instrument support metrics for Workers.
 * @returns void
 */
function resetSupportability() {
    if (origWorker) self.Worker = origWorker;  // Worker was changed by this module
    if (origSharedWorker) self.SharedWorker = origSharedWorker;
    if (origServiceWorkerCreate) self.navigator.serviceWorker.register = origServiceWorkerCreate;
    origWorker = origSharedWorker = origServiceWorkerCreate = undefined;
}

/**
 * Injects code to report Web Workers supportability and usage as metrics, replacing the native API in global scope as a side effect.
 * @param {func} report - handles reporting of supportability metrics to NR1
 * @returns void
 */
function insertSupportMetrics(report) {
    // Of the 3, the normal worker is the most widely supported, so we can be sure metric was already inserted w/o checking other 2.
    if (origWorker) return;

    if (!workersApiIsSupported.dedicated) {
        reportUnavailable('All');
        return; // similarly, if dedicated is n/a, none of them are supported so quit
    } else {
        origWorker = Worker;
        try { self.Worker = extendWorkerConstructor(origWorker, 'Dedicated'); }
        catch (e) { handleInsertionError(e, 'Dedicated'); }
    }
    
    if (!workersApiIsSupported.shared) {
        reportUnavailable('Shared');
    } else {
        origSharedWorker = SharedWorker;
        try { self.SharedWorker = extendWorkerConstructor(origSharedWorker, 'Shared'); }
        catch (e) { handleInsertionError(e, 'Shared'); }
    }
    if (!workersApiIsSupported.service) {
        reportUnavailable('Service');
    } else {
        origServiceWorkerCreate = navigator.serviceWorker.register;
        try { self.navigator.serviceWorker.register = extendServiceCreation(origServiceWorkerCreate); }
        catch (e) { handleInsertionError(e, 'Service'); }
    }
    return;

    // Internal helpers - Core
    /**
     * Report each time a Worker or SharedWorker is created in page execution. Note the current trap is set for only "new" and Reflect.construct operations.
     * @param {func obj} origClass - Worker() or SharedWorker()
     * @param {string} workerType - 'Dedicated' or 'Shared'
     * @returns Proxy worker that intercepts the original constructor
     */
    function extendWorkerConstructor(origClass, workerType) {
        const newHandler = {
            construct(oConstructor, args) {
                reportWorkerCreationAttempt(workerType, args[1]?.type);
                return new oConstructor(...args);
            }
        }
        // eslint-disable-next-line
        return new Proxy(origClass, newHandler);
    }
    /**
     * Report each time a ServiceWorkerRegistration is created or updated in page execution.
     * @param {func} origFunc - method responsible for creating a ServiceWorker
     * @returns Refer to ServiceWorkerContainer.register()
     */
    function extendServiceCreation(origFunc) {
        return (...args) => {
            reportWorkerCreationAttempt('Service', args[1]?.type);
            return origFunc.apply(navigator.serviceWorker, args);   // register() has to be rebound to the ServiceWorkerContainer object
        }
    }

    // Internal helpers - Reporting & logging
    function reportUnavailable(workerType) {
        report(`Workers/${workerType}/Unavailable`);
    }
    function reportWorkerCreationAttempt(workerType, optionType) {
        if (optionType === 'module') {
            report(`Workers/${workerType}/Module`);
        } else {
            report(`Workers/${workerType}/Classic`);
        }
    }
    function handleInsertionError(e, workerType) {
        report(`Workers/${workerType}/SM/Unsupported`); // indicates the browser version doesn't support how code is injected, such as Proxy API
        console.warn(`NR Agent: Unable to capture ${workerType} workers.`, e);
    }
}
