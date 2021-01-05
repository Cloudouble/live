# Live
The fastest, simplest way to make your HTML web app real-time with server-side data. Part of 
the [live-element](https://live-element.net) framework.

## Installation
* include the script tag for the element.js file, it creates a window.Element object
```
<script src="https://cdn.jsdelivr.net/gh/cloudouble/live@1.0.2/live.min.js"></script>
```


## Usage
* add  ```live-subscription``` and ```live-trigger``` attributes to HTML elements that you want to sync data with
* create processors functions as key / values of ```window.LiveElement.Live.processors```
* define listener configuration objects as key / values of ```window.LiveElement.Live.listeners```
* read more below about those attributes, processors and listeners, see the ```example.html``` file included here as simple guide
* watch your HTML come to life!


## Attributes to use on your elements

These attributes can be added / edited / removed at runtime and data sync will adjust instantly

### ```live-subscription```
* bring any HTML element to life just by defining it's ```live-subscription``` attribute
* the value is a space separated list of subscription vectors, with vector being a listener key, then a processor key, joined by a colon with no spaces
* every time the listener runs it will pipe its output to the given processor, the output of that processor is then used to set any combination of attributes, 
plus the value, innerHTML and innerText properties of the element
* see below for more details on how listeners work, and how to define processors to work as subscription handlers

### ```live-trigger```
* define this attribute to capture events on the element and pipe it's attributes and properties into a processor
* the attribute value is a space separated list of trigger directives, with each directive being an event name, then a processor key, joined by a colon with no spaces
* see below for how to define processors to work as trigger handlers

### Also...
* if you leave out a handler in a subscription vector or trigger directive, 'default' will be automatically added to the attribute value in your markup. This will call the built-in 
(but overridable) 'default' processor
* when your attribute value is first parsed or first parsed after being updated, the value of it will be standardised to include 'default' handlers where appropriate, plus 
multiple vectors/directives will be sorted alphabetically in the list


## Defining listeners
* add as a key / object to the ```window.LiveElement.Live.listeners``` object
* listeners run on the schedule defined by you, this can be adjusted at runtime to create any complex, responsive schedule you like
* the loop which triggers listeners to run, runs on the browser idle loop - this means that timing is not exact to the millisecond and the busier your main loop is
the more likely that eratic delays in your listener timing will occur. In normal usage this will be completely imperceptible. 
See [window.requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback) for more details on how this works.
* never use spaces in the listener key!
* the format of the listener configuration object is ```{processor: 'default', delay: 1000, expires: 1234567890, max: 10, next: 123456789}```
* ```processor``` => a key of any processor function, the listener will start running as soon as the processor function is defined
* ```delay``` => (optional) how often to run the listener in millseconds, this is a minimum - the actual loop frequency will be 10-100ms higher
* ```expires``` => (optional) a millsecond timestamp which tells the system to stop running the listener after this moment
* ```max``` => (optional) an integer which specifies the maximum number of times to run the listener
* ```next``` => (optional) a millisecond timestamp will tells the system not to run the listener again until the next tick after this time


## Defining processors
* a processor is just any function that is defined as the value of a key within ```window.LiveElement.Live.processors```
* it takes a single ```input``` argument that - if present - will be an object
* you can use the ```window.LiveElement.Live.getHandlerType(input)``` helper function to branch the execution of your processor to decide if it is being called 
as a listener handler, subscription handler or trigger handler. ```window.LiveElement.Live.getHandlerType(input)``` examines the structure of the input argument and 
returns either 'listener', 'subscription' or 'trigger' so you can handle it accordingly.


### Processors as listeners
* when called as a listener handler, the processor is called without arguments, thus ```input``` is ```undefined```
* it should return any non-null object 
* listeners will start running as soon as they and their processor are defined, even if no elements are using them. They can be used to do other work in the browser that doesn't 
relate to feeding subscribing elements.

### Processors as subscription handlers
* the processor is called with input as an object with the structure
```{listener: 'listener key', config: {current listener configuration}, payload: {the listener output object}, subscription: subscribingElement}```
* the value of ```input.config``` contains the exact listener configuration you defined, with the addition of two extra keys: ```last``` which is a millisecond timestamp of when the 
listener last ran, and ```count``` which is a incremental counter of how many times this listener has run  
* the handler should return any object, which will be used to update the subscribing element's attributes and select properties
* return object keys starting with '@' will only be used to set element attributes (with the leading '@' stripped)
* return object keys starting with '#' will only be used to set element properties (with the leading '#' stripped), any property can be set this way
* return object keys starting with anything else will be assumed to be attributes and will be set accordingly
* return object key values of ```undefined``` or ```null``` will become empty strings '' when attributes / properties are set on the subscribing element
* for example a return object of ```{'@name': 'elementname', '#value': 'the value', 'title': 'tip text'}``` will set the subscribing element as 
```<input name="elementname" title="tip text" />``` and it's visible value will be 'the value'

### Processors as trigger handlers
* the processor is called with input as an object with the structure
```{attributes: {}, map: {}, properties: {}, triggersource: triggeringElement}```
* ```attributes``` contains all the current attributes of the triggeringElement, keys without the leading '@'
* ```properties``` contains the ```value```, ```innerHTML``` and ```innerText``` properties of the element, without the leading '#'
* ```map``` contains all attributes and the ```value```, ```innerHTML``` and ```innerText``` properties, fully qualified with leading '@' or '#' as appropriate
* ```triggeringElement``` contains the triggering element itself
* the return of the handler is not used

### The default processor
* there is a ```default``` processor already defined (which can be overridden anytime) which looks like the following: 
```
        default: function(input) {
            switch(window.LiveElement.Live.getHandlerType(input)) {
                case 'listener': 
                    return {_timestamp: Date.now()}
                case 'subscription': 
                    return input.payload
                case 'trigger':
                    console.log(input)
            }
        }
```
* as a listener, this just returns an object with a single '_timestamp' key being the current timestamp
* as a subscription handler, it simply pipes through the untouched listener output
* as a trigger handler, it writes the trigger event data to the browser console
* you can override this anytime to do other 'default' things instead


## Example showing all parts together: 
```
  <input name="testinput" live-subscription="testlistener:example" live-trigger="change:example" />
  
  <script src="live.js"></script>
  <script>
    window.LiveElement.Live.processors.example = function(input) {
      switch(window.LiveElement.Live.getHandlerType(input)) {
          case 'subscription': 
              return {placeholder: input.payload._timestamp}
          case 'trigger':
              console.log(`You changed the value of ${input.attributes.name} to "${input.map['#value']}"`)
      }
    }
    window.LiveElement.Live.listeners.testlistener = {processor: 'default', delay: 1000, max: 10}
  </script>

```
* the end result of this is that the placeholder of the input element is updated 10 times - approximately once per second - with the current millisecond timestamp, 
and when the input is changed it writes a message including the input name and new value to the console.


## Hang on, where does that 'server-side' data come in?
* define your listener processor to poll an API, or whatever other method you like to retrieve structured data from the server
* define your trigger processor to push to an API, or whatever other method you like to push data back to your server
* your processor can also read-write to resources like IndexedDB, a web socket, etc - it's completely backend agnostic


## Further Reading 

[live-element framework](https://live-element.net)

[MDN Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

[IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

[Websocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
