window.LiveElement = window.LiveElement || {}
window.LiveElement.Live = window.LiveElement.Live || Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.5'}, 
    loopMaxMs: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    defaultListenerDelay: {configurable: false, enumerable: true, writable: false, value: 1000}, 
    listeners: {configurable: false, enumerable: true, writable: false, value: {}}, 
    processors: {configurable: false, enumerable: true, writable: false, value: {
        default: function(input) {
            switch(window.LiveElement.Live.getHandlerType(input)) {
                case 'listener': 
                    return { ...(input instanceof window.Event?input.detail:(input && typeof input == 'object'?input:{})), ...{_timestamp: Date.now(), _input: input}}
                case 'subscription': 
                    return input.payload
                case 'trigger':
                    console.log(input)
            }
        }
    }}, 
    subscriptions: {configurable: false, enumerable: false, writable: false, value: {}}, 
    triggers: {configurable: false, enumerable: false, writable: false, value: {}}, 
    getHandlerType: {configurable: false, enumerable: false, writable: false, value: function(input) {
        if (!input) {
            return 'listener'
        } else if (input && typeof input == 'object' && input.listener && input.config && input.payload && input.subscriber 
            && typeof input.listener == 'string' && typeof input.config == 'object' && typeof input.payload == 'object' && typeof input.subscriber == 'object' 
            && typeof input.subscriber.setAttribute == 'function') {
            return 'subscription'
        } else if (input && typeof input == 'object' && input.attributes && input.properties && input.map && input.triggersource 
            && typeof input.attributes == 'object' && typeof input.properties == 'object' && typeof input.map == 'object' && typeof input.triggersource == 'object' 
            && typeof input.triggersource.setAttribute == 'function') {
            return 'trigger'
        } else if (input) {
            return 'listener'
        }
    }}, 
    listen: {configurable: false, enumerable: false, writable: false, value: function(input, listenerKey, eventName, once=false, force=false, silent=false) {
        if (input instanceof window.Event) {
            if (window.LiveElement.Live.listeners[listenerKey]) {
                var inputOnce = {eventname: eventName, eventtarget: event.target, detail: event.detail, event: input}
                window.LiveElement.Live.runListener(listenerKey, {...window.LiveElement.Live.listeners[listenerKey], ...{force: force, silent: silent, inputOnce: inputOnce}})
            }
        } else if (input instanceof window.EventTarget) {
            eventName = eventName || (input instanceof window.HTMLInputElement || input instanceof window.HTMLSelectElement || input instanceof window.HTMLTextAreaElement ? 'change' : 'click')
            input.addEventListener(eventName, event => {
                window.LiveElement.Live.listen(event, listenerKey, eventName, once, force, silent)
            }, {once: once})
        } else {
            window.LiveElement.Live.runListener(listenerKey, {...window.LiveElement.Live.listeners[listenerKey], ...{force: force, silent: silent, inputOnce: input}})
        }
    }}, 
    runListener: {configurable: false, enumerable: false, writable: false, value: function(key, config) {
        var now = Date.now()
        if (config && typeof config == 'object'
            && (config.force || (!config.force && !config.expired)) 
            && typeof config.processor == 'string' && typeof window.LiveElement.Live.processors[config.processor] == 'function'
            && (config.force || (((config.last || 0) + (config.delay || window.LiveElement.Live.defaultListenerDelay)) < now))) {
            if (!config.force && (config.expires && (config.expires <= now))) {
                config.expired = true
                window.dispatchEvent(new window.CustomEvent('live-listener-expired', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-expired-${key}`, {detail: {listener: key, config: config}}))
            } else if (!config.force && (config.count && config.max && (config.count >= config.max))) {
                config.expired = true
                window.dispatchEvent(new window.CustomEvent('live-listener-maxed', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-maxed-${key}`, {detail: {listener: key, config: config}}))
            } else if (!config.force && (config.next && (config.next > now))) {
                window.dispatchEvent(new window.CustomEvent('live-listener-passed', {detail: {listener: key, config: config}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-passed-${key}`, {detail: {listener: key, config: config}}))
            } else {
                var showconfig = {...config}
                if (!config.silent) {
                    config.last = now
                    config.count = (config.count || 0) + 1
                    showconfig.last = config.last
                    showconfig.count = config.count
                    if (config.next) {
                        showconfig.next = config.next
                        delete config.next
                    }
                }
                if (config.inputOnce) {
                    showconfig.input = config.inputOnce
                    delete config.inputOnce
                } else if (config.input) {
                    showconfig.input = config.input
                }
                var payload = window.LiveElement.Live.processors[config.processor](showconfig.input)
                window.dispatchEvent(new window.CustomEvent('live-listener-run', {detail: {listener: key, config: showconfig, payload: payload}}))
                window.dispatchEvent(new window.CustomEvent(`live-listener-run-${key}`, {detail: {listener: key, config: showconfig, payload: payload}}))
            }
        }
    }},
    run: {configurable: false, enumerable: false, writable: false, value: function() {
        Object.entries(window.LiveElement.Live.listeners).forEach(entry => {
            window.LiveElement.Live.runListener(...entry)
        })
        var processElement = function(element, type) {
            var firstPass = false
            var cleanVectors
            var listAttributeValueChanged
            var listAttribute = (element.getAttribute(`live-${type}`) || '')
            var referenceLabel = type == 'subscription' ? 'subscriber': 'triggersource'
            var flags = type == 'subscription' ? window.LiveElement.Live.subscriptions: window.LiveElement.Live.triggers
            var reference = element.getAttribute(`live-${referenceLabel}`)
            if (!element.hasAttribute(`live-${referenceLabel}`)) {
                firstPass = true
                cleanVectors = []
                listAttributeValueChanged = false
                element.setAttribute(`live-${referenceLabel}`, `${Date.now()}-${parseInt(Math.random()*1000000000)}`)
                reference = element.getAttribute(`live-${referenceLabel}`)
            } else if (!firstPass && reference && flags[reference] && typeof flags[reference] == 'object' 
                && Object.keys(flags[reference]).sort().join(' ') != listAttribute) {
                firstPass = true
            }
            var vectorList = listAttribute.split(' ')
            if (firstPass) {
                vectorList = vectorList.sort().filter(v => !!v)
            }
            if (firstPass && flags[reference] && typeof flags[reference] == 'object') {
                Object.keys(flags[reference]).forEach(vector => {
                    var vectorSplit = vector.split(':')
                    if (!vectorList.includes(vector)) {
                        var eventType = type == 'subscription' ? `live-listener-run-${vectorSplit[0]}` : vectorSplit[0]
                        var listeningElement =  type == 'subscription' ? window : element
                        listeningElement.removeEventListener(eventType, flags[reference][vector])
                    }
                })
            }
            vectorList.forEach(vector => {
                if (firstPass) {
                    let originalVector = vector
                    let colonIndex = vector.indexOf(':')
                    if (colonIndex != -1) { vector = vector.replace(/:+/g, ':') }
                    colonIndex = vector.indexOf(':')
                    if (colonIndex === 0) { vector = vector.slice(1) }
                    colonIndex = vector.indexOf(':')
                    if (colonIndex == -1) { vector = `${vector}:default` } else if (colonIndex == vector.length-1) { vector = `${vector}default` }
                    listAttributeValueChanged = originalVector != vector
                    cleanVectors.push(vector)
                }
                if (!flags[reference]) { flags[reference] = {} }
                if (!flags[reference][vector]) {
                    var vectorSplit = vector.split(':')
                    flags[reference][vector] = function(event) {
                        if (typeof window.LiveElement.Live.processors[vectorSplit[1]] == 'function') {
                            var handlerInput =  type == 'subscription' ? {...event.detail, ...{subscriber: element}} 
                                : {
                                    ...event.detail, 
                                    ...{
                                        attributes: Object.assign({}, ...Array.from(element.attributes).map(a => ({[a.name]: a.value}))), 
                                        properties: {value: element.value, innerHTML: element.innerHTML, innerText: element.innerText}, 
                                        map: {
                                            ...Object.assign({}, ...Array.from(element.attributes).map(a => ({[`@${a.name}`]: a.value}))), 
                                            ...{'#value': element.value, '#innerHTML': element.innerHTML, '#innerText': element.innerText}
                                        }, 
                                        triggersource: element, 
                                        event: event,
                                        vector: vector
                                    }
                                }
                            var handledPayload = window.LiveElement.Live.processors[vectorSplit[1]](handlerInput)
                            if (type == 'subscription' && handledPayload && typeof handledPayload == 'object') {
                                Object.keys(handledPayload).forEach(k => {
                                    handledPayload[k] = handledPayload[k] === undefined ? '' : (handledPayload[k] === null ? '' : handledPayload[k])
                                    if (k && k[0] == '#') {
                                        element[k.slice(1)] = handledPayload[k]
                                    } else if (k && k[0] == '@') {
                                        element.setAttribute(k.slice(1), handledPayload[k])
                                    } else {
                                        element.setAttribute(k, handledPayload[k])
                                    }
                                })
                            }
                        }
                    }
                    var eventType = type == 'subscription' ? `live-listener-run-${vectorSplit[0]}` : vectorSplit[0]
                    var listeningElement =  type == 'subscription' ? window : element
                    listeningElement.addEventListener(eventType, flags[reference][vector])
                }
            })
            if (firstPass && listAttributeValueChanged) {
                element.setAttribute(`live-${type}`, cleanVectors.sort().join(' '))
            } else if (firstPass && (listAttribute != vectorList.join(' '))) {
                element.setAttribute(`live-${type}`, vectorList.sort().join(' '))
            }
        }
        document.querySelectorAll('[live-subscription]').forEach(subscribedElement => {
            processElement(subscribedElement, 'subscription')
        })
        document.querySelectorAll('[live-trigger]').forEach(triggeringElement => {
            processElement(triggeringElement, 'trigger')
        })
        window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})        
    }}
})
Object.freeze(window.LiveElement.Live)
window.requestIdleCallback = window.requestIdleCallback || function(handler) {let sT = Date.now(); return window.setTimeout(function() {handler({didTimeout: false, timeRemaining: function() {return Math.max(0, 50.0 - (Date.now() - sT)) }})}, 1)}
window.requestIdleCallback(window.LiveElement.Live.run, {options: window.LiveElement.Live.loopMaxMs || 1000})
