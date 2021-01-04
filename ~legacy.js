/* global location fetch customElements HTMLElement navigator AWS jsQR crypto TextEncoder TextDecoder atob Blob Event Headers btoa jsPDF html2canvas CustomEvent */
window.ParkOne = window.ParkOne || {}
window.ParkOne._ = window.ParkOne._ || {}
window.ParkOne._.methods = window.ParkOne._.methods || {}
window.ParkOne._.variables = window.ParkOne._.variables || {}
window.ParkOne._.config = window.ParkOne._.config || {}
window.ParkOne._.AWS = window.ParkOne._.AWS || {}
window.ParkOne._.components = window.ParkOne._.components || {}
window.ParkOne._.templates = window.ParkOne._.templates || {}
window.ParkOne._.subscriptions = {}
window.ParkOne._.notifications = {}
window.ParkOne._.data = window.ParkOne._.data || {}
window.ParkOne._.callbacks = window.ParkOne._.callbacks || {}


/** METHODS */
window.ParkOne._.methods.getCookie = function(name) { var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)'); return v ? v[2] : null; }
window.ParkOne._.methods.setCookie = function(name, value, _expires) { var d = new Date; d.setTime(_expires ? _expires*1000 : d.getTime()); document.cookie = name + "=" + value + ";path=/;expires=" + d.toGMTString(); }
window.ParkOne._.methods.deleteCookie = function(name) { window.ParkOne._.methods.setCookie(name, '', -1); }
window.ParkOne._.methods.getSessionId = function(synchronous=false) {
    var sessionId = window.ParkOne._.methods.getCookie('ParkOneSessionId')
    var sessionExpires = window.ParkOne._.methods.getCookie('ParkOneSessionExpires')
    var now = Math.round(Date.now()/1000)
    var retval = (sessionId && sessionExpires && sessionExpires > now) ? sessionId : null
    return synchronous ? retval : Promise.resolve(retval)
}
window.ParkOne._.methods.processCallback = function(data) {
    var callbacks = data.context.indexOf('Root') > -1 ? window.ParkOne._.callbacks : (window.ParkOne._.variables.clientApp && window.ParkOne[window.ParkOne._.variables.clientApp] ? window.ParkOne[window.ParkOne._.variables.clientApp].callbacks : undefined)
    if (!callbacks && data.callback) {
        if (window.ParkOne._.variables.clientApp && window.ParkOne[window.ParkOne._.variables.clientApp] && window.ParkOne[window.ParkOne._.variables.clientApp].callbacks 
                && typeof window.ParkOne[window.ParkOne._.variables.clientApp].callbacks == 'object' && window.ParkOne[window.ParkOne._.variables.clientApp].callbacks[data.callback] 
                && typeof window.ParkOne[window.ParkOne._.variables.clientApp].callbacks[data.callback] == 'function') {
            callbacks = window.ParkOne[window.ParkOne._.variables.clientApp].callbacks
        } else if (window.ParkOne._.callbacks && window.ParkOne._.callbacks[data.callback] && typeof window.ParkOne._.callbacks[data.callback] == 'function') {
            callbacks = window.ParkOne._.callbacks
        } else {
            data.context = 'ClientAPI'
        }
    }
    if (callbacks && data.callback && callbacks[data.callback] && typeof callbacks[data.callback] == 'function') {
        callbacks[data.callback](data.payload)
    } else if (data.context == 'ClientAPI' && data.path) {
        var apiparams = {path: data.path}
        if (data.method) { apiparams.method = data.method }
        if (data.payload) { apiparams.payload = data.payload }
        window.ParkOne._.methods.APICall(...{apiparams})
    }
}
window.ParkOne._.methods.refreshData = function(now, sessionId) {
    if (now && sessionId && window.ParkOne._ && window.ParkOne._.AWS && window.ParkOne._.AWS.DynamoDBDocumentClient) {
        window.ParkOne._.variables.dataLastRefreshed = now
        window.ParkOne._.AWS.DynamoDBDocumentClient.query({
            TableName: '_subscription',
            IndexName: '_session-index', 
            KeyConditionExpression: '#session = :session', 
            ExpressionAttributeNames: {'#session': '_session'}, 
            ExpressionAttributeValues: {':session': sessionId}
        }, function(err, data) {
            if (!err && data && data.Items) {
                var subscriptionsToPropagate = []
                var p = []
                data.Items.forEach(subscriptionRecord => {
                    if (subscriptionRecord && subscriptionRecord.key && subscriptionRecord.secret && subscriptionRecord._updated) {
                        window.ParkOne._.subscriptions[subscriptionRecord.key] = subscriptionRecord
                        if (
                                (!window.ParkOne._.data[subscriptionRecord.key]) || 
                                (!window.ParkOne._.data[subscriptionRecord.key]._updated) || 
                                (subscriptionRecord._updated > window.ParkOne._.data[subscriptionRecord.key]._updated)
                        ) {
                            p.push(new Promise(function(resolve, reject) {
                                window.ParkOne._.AWS.S3.getObject({
                                    Bucket: 'parkone.session', 
                                    Key: `${sessionId}/${subscriptionRecord.secret}.json`
                                }, function(err, data) {
                                    if (!err && data && data.Body) {
                                        try {
                                            var dataResult = JSON.parse(new TextDecoder('utf-8').decode(data.Body))
                                            if (typeof dataResult == 'object') {
                                                if (dataResult) {
                                                    window.ParkOne._.data[subscriptionRecord.key] = dataResult
                                                    window.ParkOne._.data[subscriptionRecord.key]._updated = subscriptionRecord._updated || now
                                                } else {
                                                    delete window.ParkOne._.data[subscriptionRecord.key]
                                                }
                                                subscriptionsToPropagate.push(subscriptionRecord.key)
                                            }
                                            resolve()
                                        } catch(e) {
                                            window.ParkOne._.methods.console('parkone.js', 589, e)
                                            reject()
                                        }
                                    } else {
                                        window.ParkOne._.methods.console('parkone.js', 587, data)
                                        reject()
                                    }
                                })
                            }))
                        }
                    }
                })
                Promise.all(p).then(() => {
                    if (subscriptionsToPropagate.length) {
                        window.ParkOne._.methods.propagateSubscriptions(subscriptionsToPropagate)
                    }
                })
            } else {
                window.ParkOne._.methods.console('parkone.js', 609, err)
            }
        })
    }
}
window.ParkOne._.methods.propagateSubscriptions = function(keys) {
    //data="subscriptionKey:transformName:attributeName subscriptionKey2:transformName2:attributeName2 etc..."
    var results = Object.assign({}, ...Array.from(document.querySelectorAll('[data]')).flatMap(e => e.getAttribute('data').split(' ')).filter(v => v && (v.replace(/[^:]/g, '').length == 2)).map(v => ({[v]: 
        v.split(':').map((vv, vi) => vi == 0 ? window.ParkOne._.data[vv] : (vi == 1 ? window.ParkOne[window.ParkOne._.variables.clientApp].callbacks[vv] || window.ParkOne._.callbacks[vv] || window.ParkOne._.callbacks._ : vv))
            .map((v, i, a) => i===0?{[a[2]]:a[1](a[0])}:false)[0]
    })))
    Object.keys(results).sort().forEach(vector => {
        document.querySelectorAll(`[data~="${vector}"]`).forEach(elem => {
            var attributeName = Object.keys(results[vector])[0]
            var attributeValue = results[vector][attributeName]
            if (attributeName == 'innerHTML' && elem.innerHTML != attributeValue) {
                elem.innerHTML = attributeValue
            } else if (elem.getAttribute(attributeName) != attributeValue) {
                elem.setAttribute(attributeName, attributeValue)
            }
        })
    })
}
window.ParkOne._.methods.initialiseUpdatingAndTriggeringElements = function() {
    var body  = document.querySelector('body') 
    if (!body.hasAttribute('update-trigger-initialised')) {
        window.ParkOne._.variables.callbacks = {...window.ParkOne._.callbacks, ...window.ParkOne[window.ParkOne._.variables.clientApp].callbacks}
        ;(['update', 'trigger']).forEach(eventType => {
            document.querySelectorAll(`[${eventType}]:not([${eventType}-initialised])`).forEach(element => {
                var statements = (element.getAttribute(eventType) || '').split(' ').filter(v => v)
                statements.forEach(statement  => {
                    var vector = statement.split(':')
                    if (vector.length == 2) {
                        vector.push(null)
                    } else if (vector.length == 1) {
                        vector.unshift(eventType == 'update' ? 'change' : 'click')
                        vector.push(null)
                    }
                    var callback = vector.pop() || null
                    var sourceEvent = vector.shift() || (eventType == 'update' ? 'change' : 'click')
                    var dataMap = vector.join(':') || '#value'
                    sourceEvent.split(',').forEach(et => {
                        element.addEventListener(et, evt => {
                            evt.target.dispatchEvent(new CustomEvent(eventType, {bubbles: true, composed: true, detail: {callback: callback, dataMap: dataMap}}))
                        })
                    })
                })
                element.setAttribute(`${eventType}-initialised`, 'true')
            })
            body.addEventListener(eventType, event => {
                window.ParkOne._.methods[`processElement${eventType[0].toUpperCase()}${eventType.slice(1).toLowerCase()}`](event.target, event.detail.callback, event.detail.dataMap) 
            })
            body.setAttribute(`${eventType}-initialised`, 'true')
        })
        body.setAttribute('update-trigger-initialised', 'true')
    }
}
window.ParkOne._.methods.processElementUpdate = function(element, callback='noop', dataMap='#value') {
    window.ParkOne._.methods.processElementTrigger(element, callback, dataMap, 'update').then(dataMap => {
        window.ParkOne._.methods.processDatamap(dataMap)
    })
}
window.ParkOne._.methods.processElementTrigger = function(element, callback='noop', dataMap='#value', scope='trigger') {
    scope = scope == 'update' ? 'update' : 'trigger'
    callback = window.ParkOne._.variables.callbacks[callback] || window.ParkOne._.variables.callbacks.noop 
    dataMap = dataMap || '#value'
    if (dataMap) {
        if (dataMap.indexOf('@') > -1) {
            element.getAttributeNames().forEach(attributeName => {
                dataMap = dataMap.replace(new RegExp(`@${attributeName}`, 'g'), JSON.stringify(element.getAttribute(attributeName)))
            })
        }
        ;(['value', 'valueAsDate', 'valueAsNumber', 'defaultValue', 'nodeValue', 'checked', 'innerText', 'innerHTML', 'outerHTML', 'tagName', 'nodeName', 'nodeType', 'textContent']).forEach(p => {
            if (dataMap.indexOf(`#${p}`) > -1) {
                dataMap = dataMap.replace(new RegExp(`#${p}`, 'g'), JSON.stringify(element[p]))
            }
        })
    }
    try {
        return Promise.resolve(callback(JSON.parse(dataMap)))
    } catch(err) {
        window.ParkOne._.methods.console('parkone.js', 688, err)
    }
}
window.ParkOne._.methods.processDatamap = function(dataMap) {
    if (dataMap && typeof dataMap == 'object') {
        Object.entries(dataMap).forEach(subscriptionUpdateMap => window.ParkOne._.methods.updateDB(...subscriptionUpdateMap))
    }
}
window.ParkOne._.methods.updateDB = function(key, statement={}) {
    if (key && window.ParkOne._.subscriptions[key] && statement && (typeof statement == 'object')) {
        var payload = {_session: window.ParkOne._.methods.getSessionId(true), key: key, statement: {}}
        if (!statement.UpdateExpression) {
            statement = {UpdateExpression: JSON.parse(JSON.stringify(statement))}
        }
        if (typeof statement.UpdateExpression == 'object') {
            payload.statement.UpdateExpression =  'SET ' + Object.keys(statement.UpdateExpression).map(k => `#${k.toUpperCase()}=:${k.toUpperCase()}`).join(', ')
            payload.statement.ExpressionAttributeNames = Object.assign({}, ...Object.keys(statement.UpdateExpression).map(k => ({[`#${k.toUpperCase()}`]: k})))
            payload.statement.ExpressionAttributeValues = Object.assign({}, ...Object.keys(statement.UpdateExpression).map(k => ({[`:${k.toUpperCase()}`]: statement.UpdateExpression[k]})))
        } else {
            payload.statement.UpdateExpression = String(payload.statement.UpdateExpression)
        }
        if (statement.ExpressionAttributeNames && (typeof statement.ExpressionAttributeNames == 'object')) {
            payload.statement.ExpressionAttributeNames = {...payload.statement.ExpressionAttributeNames, ...statement.ExpressionAttributeNames}
        }
        if (statement.ExpressionAttributeValues && (typeof statement.ExpressionAttributeValues == 'object')) {
            payload.statement.ExpressionAttributeValues = {...payload.statement.ExpressionAttributeValues, ...statement.ExpressionAttributeValues}
        }
        if (statement.ConditionExpression) {
            if (typeof statement.ConditionExpression == 'object') {
                payload.statement.ConditionExpression = Object.keys(statement.ConditionExpression).map(k => `#${k.toUpperCase()}=:${k.toUpperCase()}`).join(' AND ')
            }
            if (typeof statement.ConditionExpression == 'string') {
                payload.statement.ConditionExpression = statement.ConditionExpression
            }
        }
        return new Promise(function(resolve, reject) {
            window.ParkOne._.AWS.Lambda.invoke({
                FunctionName: 'db-update', 
                InvocationType: 'Event', 
                Payload: JSON.stringify(payload) 
            }, function(err, data) {
                if (!err) {
                    resolve()
                } else {
                    reject()
                }
            })
        })
    } 
}


/** CALLBACKS */
window.ParkOne._.callbacks.noop = function(input) {
    return input
}
window.ParkOne._.callbacks.console = function(input) {
    console.log('parkone.js: callback.console: line 700: ', input)
    return input
}
window.ParkOne._.callbacks.getName = function(input) {
    return input.name 
}
window.ParkOne._.callbacks.getCount = function(input) {
    return input && typeof input == 'object' && input.constructor.name == 'Array' ? input.length : 1
}