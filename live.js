window.LiveElement = window.LiveElement || {}
window.LiveElement.Live = window.LiveElement.Live || Object.defineProperties({}, {
    version: {configurable: false, enumerable: true, writable: false, value: '1.0.0'}, 
    subscriptions: {configurable: false, enumerable: true, writable: true, value: {
        subscription: {callback: '', delay: 1000, last: 12345, expires: 12345}
    }}, 

    
    loadJSON: {configurable: false, enumerable: false, writable: false, value: function(url) {
        url = url.indexOf('https://') === 0 ? url : `${window.LiveElement.Element.root}/${url}`
        url = (url.lastIndexOf('.json') == (url.length - '.json'.length)) ? url : `${url}.json`
        return window.fetch(url).then(r => r.json())
    }}, 
    
    
    
    
    
})