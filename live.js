window.LiveElement = window.LiveElement || {}
window.LiveElement.Live = window.LiveElement.Live || Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'}, 
    loopMaxMs: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    defaultListenerDelay: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    subscriptions: {configurable: false, enumerable: true, writable: false, value: {}}, 
    listeners: {configurable: false, enumerable: true, writable: false, value: {}}, 
    processors: {configurable: false, enumerable: true, writable: false, value: {}}, 
    processListener: {configurable: false, enumerable: false, writable: false, value: function(key, config) {
        //console.log('line 10', key)
        var now = Date.now()
        if (config && typeof config == 'object'
            && typeof config.processor == 'string' && typeof window.LiveElement.Live.processors[config.processor] == 'function'
            && (((config.last || 0) + (config.delay || window.LiveElement.Live.defaultListenerDelay)) < now)) {
            window.LiveElement.Live.listeners[key].last = now
            window.LiveElement.Live.processors[config.processor]()
        }
    }},
    run: {configurable: false, enumerable: false, writable: false, value: function() {
        Object.entries(window.LiveElement.Live.listeners).forEach(entry => {
            window.LiveElement.Live.processListener(...entry)
        })
        /*document.querySelectorAll('[live-subscription]').forEach(subscribedElement => {
            
        })*/
        window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})        
    }}
})
Object.freeze(window.LiveElement.Live)
window.requestIdleCallback = window.requestIdleCallback || function(handler) {let sT = Date.now(); return window.setTimeout(function() {handler({didTimeout: false, timeRemaining: function() {return Math.max(0, 50.0 - (Date.now() - sT)) }})}, 1)}
window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})