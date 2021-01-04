window.LiveElement = window.LiveElement || {}
window.LiveElement.Live = window.LiveElement.Live || Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'}, 
    loopMaxMs: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    defaultListenerDelay: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    listeners: {configurable: false, enumerable: true, writable: false, value: {}}, 
    processors: {configurable: false, enumerable: true, writable: false, value: {}}, 
    subscriptions: {configurable: false, enumerable: false, writable: false, value: {}}, 
    runListener: {configurable: false, enumerable: false, writable: false, value: function(key, config) {
        var now = Date.now()
        if (config && typeof config == 'object'
            && !config.expired 
            && typeof config.processor == 'string' && typeof window.LiveElement.Live.processors[config.processor] == 'function'
            && (((config.last || 0) + (config.delay || window.LiveElement.Live.defaultListenerDelay)) < now)) {
            if (config.expires && (config.expires <= now)) {
                config.expired = true
                window.dispatchEvent(new window.CustomEvent('live-listener-expired', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-expired-${key}`, {detail: {listener: key, config: config}}))
            } else if (config.count && config.max && (config.count >= config.max)) {
                config.expired = true
                window.dispatchEvent(new window.CustomEvent('live-listener-maxed', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-maxed-${key}`, {detail: {listener: key, config: config}}))
            } else if (config.next && (config.next > now)) {
                window.dispatchEvent(new window.CustomEvent('live-listener-passed', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-passed-${key}`, {detail: {listener: key, config: config}}))
            } else {
                config.last = now
                config.count = (config.count || 0) + 1
                var showconfig = {...config}
                if (config.next) {
                    showconfig.next = config.next
                    delete config.next
                }
                var payload = window.LiveElement.Live.processors[config.processor]()
                window.dispatchEvent(new window.CustomEvent('live-listener-run', {detail: {listener: key, config: showconfig, payload: payload}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-run-${key}`, {detail: {listener: key, config: showconfig, payload: payload}}))
            }
        }
    }},
    run: {configurable: false, enumerable: false, writable: false, value: function() {
        Object.entries(window.LiveElement.Live.listeners).forEach(entry => {
            window.LiveElement.Live.runListener(...entry)
        })
        document.querySelectorAll('[live-subscription]').forEach(subscribedElement => {
            var firstPass = false
            var cleanVectors
            var vectorAttributeValueChanged
            if (!subscribedElement.hasAttribute('live-subscriber')) {
                firstPass = true
                cleanVectors = []
                vectorAttributeValueChanged = false
                subscribedElement.setAttribute('live-subscriber', `${Date.now()}-${parseInt(Math.random()*1000000000)}`)
            }
            var vectorList = (subscribedElement.getAttribute('live-subscription') || '').split(' ')
            vectorList.forEach(vector => {
                if (firstPass) {
                    let originalVector = vector
                    let colonIndex = vector.indexOf(':')
                    if (colonIndex != -1) { vector = vector.replace(/:+/g, ':') }
                    colonIndex = vector.indexOf(':')
                    if (colonIndex === 0) { vector = vector.slice(1) }
                    colonIndex = vector.indexOf(':')
                    if (colonIndex == -1) { vector = `${vector}:default` } else if (colonIndex == vector.length-1) { vector = `${vector}default` }
                    vectorAttributeValueChanged = originalVector != vector
                    cleanVectors.push(vector)
                }
                var subscriberReference = subscribedElement.getAttribute('live-subscriber')
                if (!window.LiveElement.Live.subscriptions[subscriberReference]) { window.LiveElement.Live.subscriptions[subscriberReference] = {} }
                if (!window.LiveElement.Live.subscriptions[subscriberReference][vector]) {
                    var vectorSplit = vector.split(':')
                    var listener = vectorSplit[0]
                    var handler = vectorSplit[1]
                    window.LiveElement.Live.subscriptions[subscriberReference][vector] = function(event) {
                        if (typeof window.LiveElement.Live.processors[handler] == 'function') {
                            var handledPayload = window.LiveElement.Live.processors[handler]({...event.detail, ...{subscriber: subscribedElement}})
                            if (handledPayload && typeof handledPayload == 'object') {
                                Object.keys(handledPayload).forEach(k => {
                                    handledPayload[k] = handledPayload[k] === undefined ? '' : (handledPayload[k] === null ? '' : handledPayload[k])
                                    if (k && k[0] == '#') {
                                        subscribedElement[k.slice(1)] = handledPayload[k]
                                    } else if (k && k[0] == '@') {
                                        subscribedElement.setAttribute(k.slice(1), handledPayload[k])
                                    } else {
                                        subscribedElement.setAttribute(k, handledPayload[k])
                                    }
                                })
                            }
                        }
                    }
                    window.addEventListener(`live-listener-run-${listener}`, window.LiveElement.Live.subscriptions[subscriberReference][vector])
                }
            })
            if (firstPass && vectorAttributeValueChanged) {
                subscribedElement.setAttribute('live-subscription', cleanVectors.join(' '))
            }
        })
        window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})        
    }}
})
Object.freeze(window.LiveElement.Live)
window.requestIdleCallback = window.requestIdleCallback || function(handler) {let sT = Date.now(); return window.setTimeout(function() {handler({didTimeout: false, timeRemaining: function() {return Math.max(0, 50.0 - (Date.now() - sT)) }})}, 1)}
window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})
