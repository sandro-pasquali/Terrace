"use strict";

module.exports = function(options) {

options = options || {};

var	$	= this;

/* Copyright (c) 2010-2012 Marcus Westin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var store = {},
    win = window,
    doc = win.document,
    localStorageName = 'localStorage',
    globalStorageName = 'globalStorage',
    namespace = '__storejs__',
    storage

// Functions to encapsulate questionable FireFox 3.6.13 behavior 
// when about.config::dom.storage.enabled === false
// See https://github.com/marcuswestin/store.js/issues#issue/13
var isLocalStorageNameSupported = function() {
    try { return (localStorageName in win && win[localStorageName]) }
    catch(err) { return false }
}

var isGlobalStorageNameSupported = function() {
    try { return (globalStorageName in win && win[globalStorageName] && win[globalStorageName][win.location.hostname]) }
    catch(err) { return false }
}	

store.disabled = false
store.set = function(key, value) {}
store.get = function(key) {}
store.remove = function(key) {}
store.clear = function() {}
store.transact = function(key, transactionFn) {
    var val = store.get(key)
    if (typeof val == 'undefined') { val = {} }
    transactionFn(val)
    store.set(key, val)
}

store.serialize = function(value) {
    return JSON.stringify(value)
}
store.deserialize = function(value) {
    if (typeof value != 'string') { return undefined }
    return JSON.parse(value)
}

if (isLocalStorageNameSupported()) {
    storage = win[localStorageName]
    store.set = function(key, val) {
        if (val === undefined) { return store.remove(key) }
        storage.setItem(key, store.serialize(val))
    }
    store.get = function(key) { return store.deserialize(storage.getItem(key)) }
    store.remove = function(key) { storage.removeItem(key) }
    store.clear = function() { storage.clear() }

} else if (isGlobalStorageNameSupported()) {
    storage = win[globalStorageName][win.location.hostname]
    store.set = function(key, val) {
        if (val === undefined) { return store.remove(key) }
        storage[key] = store.serialize(val)
    }
    store.get = function(key) { return store.deserialize(storage[key] && storage[key].value) }
    store.remove = function(key) { delete storage[key] }
    store.clear = function() { for (var key in storage ) { delete storage[key] } }

} else if (doc.documentElement.addBehavior) {
    var storageOwner,
        storageContainer
    // Since #userData storage applies only to specific paths, we need to
    // somehow link our data to a specific path.  We choose /favicon.ico
    // as a pretty safe option, since all browsers already make a request to
    // this URL anyway and being a 404 will not hurt us here.  We wrap an
    // iframe pointing to the favicon in an ActiveXObject(htmlfile) object
    // (see: http://msdn.microsoft.com/en-us/library/aa752574(v=VS.85).aspx)
    // since the iframe access rules appear to allow direct access and
    // manipulation of the document element, even for a 404 page.  This
    // document can be used instead of the current document (which would
    // have been limited to the current path) to perform #userData storage.
    try {
        storageContainer = new ActiveXObject('htmlfile')
        storageContainer.open()
        storageContainer.write('<s' + 'cript>document.w=window</s' + 'cript><iframe src="/favicon.ico"></frame>')
        storageContainer.close()
        storageOwner = storageContainer.w.frames[0].document
        storage = storageOwner.createElement('div')
    } catch(e) {
        // somehow ActiveXObject instantiation failed (perhaps some special
        // security settings or otherwse), fall back to per-path storage
        storage = doc.createElement('div')
        storageOwner = doc.body
    }
    var withIEStorage = function(storeFunction) {
        return function() {
            var args = Array.prototype.slice.call(arguments, 0)
            args.unshift(storage)
            // See http://msdn.microsoft.com/en-us/library/ms531081(v=VS.85).aspx
            // and http://msdn.microsoft.com/en-us/library/ms531424(v=VS.85).aspx
            storageOwner.appendChild(storage)
            storage.addBehavior('#default#userData')
            storage.load(localStorageName)
            var result = storeFunction.apply(store, args)
            storageOwner.removeChild(storage)
            return result
        }
    }
    store.set = withIEStorage(function(storage, key, val) {
        if (val === undefined) { return store.remove(key) }
        storage.setAttribute(key, store.serialize(val))
        storage.save(localStorageName)
    })
    store.get = withIEStorage(function(storage, key) {
        return store.deserialize(storage.getAttribute(key))
    })
    store.remove = withIEStorage(function(storage, key) {
        storage.removeAttribute(key)
        storage.save(localStorageName)
    })
    store.clear = withIEStorage(function(storage) {
        var attributes = storage.XMLDocument.documentElement.attributes
        storage.load(localStorageName)
        for (var i=0, attr; attr = attributes[i]; i++) {
            storage.removeAttribute(attr.name)
        }
        storage.save(localStorageName)
    })
}

try {
    store.set(namespace, namespace)
    if (store.get(namespace) != namespace) { store.disabled = true }
    store.remove(namespace)
} catch(e) {
    store.disabled = true
}

if (typeof module != 'undefined') { module.exports = store }
else if (typeof define === 'function' && define.amd) { define(store) }
else { this.store = store }

$.addKit("store", {

    "set"   : store.set,
    "get"   : store.get,
    remove  : store.remove,
    clear   : store.clear

});

return $.store;

} // end exports / function