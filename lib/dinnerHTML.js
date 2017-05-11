var dinnerHTML = (function () {
  "use strict";
  var KEY = "data-unique-key"
    , NODE_TYPE = {
      ELEMENT_NODE: Node.ELEMENT_NODE || 1,
      TEXT_NODE: Node.TEXT_NODE || 3
    }
    , KEY_STORE = []
    , KEY_SEED = 0;

  return function dinnerHTML(node, html) {
    var newNode = getNodeFromHtml(html);
    diff(newNode, node);
    KEY_STORE = []
    KEY_SEED = 0;
    return html;
  }

  function getNodeFromHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }

  function diff(newNode, oldNode) {
    var i = 0;

    //0. align the childNodes
    align(newNode, oldNode);
    //1. compare every single childNode
    if (newNode.childNodes.length !== oldNode.childNodes.length) {
      throw "dinnerHTML: Logic Error."
    }
    for (i = 0; i < newNode.childNodes.length; i++) {
      compare(newNode.childNodes[i], oldNode.childNodes[i]);
    }
  }

  function compare(newNode, oldNode) {
    var pointer;

    if (shouldReplace(newNode, oldNode)) {
      oldNode.parentNode.replaceChild(newNode.cloneNode(true), oldNode);
      return;
    }

    if (shouldSetSelectedState(oldNode)) {
      oldNode.selected = newNode.selected;
    }
    if (shouldSetCheckedState(oldNode)) {
      oldNode.checked = newNode.checked;
    }

    if (shouldSetValue(oldNode)) {
      if (shouldSetPointer(oldNode)) {
        pointer = storePointer(oldNode);
      }
      oldNode.value = newNode.value;
      if (shouldSetPointer(oldNode)) {
        reStorePointer(oldNode, pointer);
      }
    }

    if (oldNode.nodeType === NODE_TYPE.ELEMENT_NODE) {
      diffAttributes(newNode, oldNode);

      if (!(oldNode instanceof HTMLTextAreaElement)) {
        diff(newNode, oldNode);
      }
    }
  }

  function shouldReplace(newNode, oldNode) {
    if (oldNode.nodeType !== newNode.nodeType) {
      return true;
    }

    if (oldNode.nodeType === newNode.nodeType) {
      if (oldNode.nodeType === NODE_TYPE.ELEMENT_NODE
        && oldNode.tagName !== newNode.tagName) {
        return true;
      }

      if (oldNode.nodeType === NODE_TYPE.TEXT_NODE
        && oldNode.nodeValue !== newNode.nodeValue) {
        return true;
      }

      if ((oldNode instanceof HTMLInputElement)
        && (newNode instanceof HTMLInputElement)
        && oldNode.type !== newNode.type) {
        return true;
      }
    }

    return false;
  }

  function shouldSetSelectedState(node) {
    return (node instanceof HTMLOptionElement);
  }

  function shouldSetCheckedState(node) {
    if (node instanceof HTMLInputElement) {
      switch (node.type) {
        case "radio":
        case "checkbox":
          return true;
        default:
          return false;
      }
    }
    return false;
  }

  function shouldSetValue(node) {
    // text box whose content would be changed by non-script
    if (node instanceof HTMLTextAreaElement) {
      return true;
    }
    if (node instanceof HTMLInputElement) {
      switch (node.type) {
        case "radio":
        case "checkbox":
        case "button":
        case "file":
        case "image":
        case "reset":
        case "submit":
          return false;
        default:
          return true;
      }
    }
    return false;
  }

  function shouldSetPointer(node) {
    return shouldSetValue(node) && document.activeElement === node;
  }

  function storePointer(node) {
    var pointer = {
      start: 0,
      end: 0
    };
    if ("selectionStart" in node && document.activeElement == node) {
      return {
        start: node.selectionStart,
        end: node.selectionEnd
      };
    } else if (node.createTextRange && document.activeElement == node) {
      var sel = document.selection.createRange();
      if (sel.parentElement() === node) {
        var rng = node.createTextRange();
        rng.moveToBookmark(sel.getBookmark());
        for (var len = 0; rng.compareEndPoints("EndToStart", rng) > 0; rng.moveEnd("character", -1)) {
          len++;
        }
        rng.setEndPoint("StartToStart", node.createTextRange());
        for (pointer = { start: 0, end: len }; rng.compareEndPoints("EndToStart", rng) > 0; rng.moveEnd("character", -1)) {
          pointer.start++;
          pointer.end++;
        }
        return pointer;
      }
    }
    return pointer;
  }

  function reStorePointer(node, pointer) {
    var start = pointer.start
      , end = pointer.end;

    if ("selectionStart" in node) {
      node.selectionStart = start;
      node.selectionEnd = end;
    } else if (node.createTextRange) {
      let rng = node.createTextRange();
      rng.moveStart("character", start);
      rng.collapse();
      rng.moveEnd("character", end - start);
      rng.select();
    }
  }

  function diffAttributes(newNode, oldNode) {
    var i = 0
      , newList = getAttributeList(newNode)
      , oldList = getAttributeList(oldNode);

    for (i = 0; i < newList.length; i++) {
      oldNode.setAttribute(newList[i].name, newList[i].value);
    }
    for (i = 0; i < oldList.length; i++) {
      if (!newNode.hasAttribute(oldList[i].name)) {
        oldNode.removeAttribute(oldList[i].name);
      }
    }
  }

  function getAttributeList(node) {
    var list = [], i;
    for (i = 0; i < node.attributes.length; i++) {
      list.push({
        name: node.attributes[i].nodeName,
        value: node.attributes[i].nodeValue,
      })
    }
    return list;
  }

  function align(newNode, oldNode) {
    var i;
    if (hasKey(newNode, oldNode)) {
      sort(newNode, oldNode);
    }
    while (newNode.childNodes.length < oldNode.childNodes.length) {
      oldNode.removeChild(oldNode.lastChild);
    }

    for (i = oldNode.childNodes.length; i < newNode.childNodes.length; i++) {
      oldNode.appendChild(newNode.childNodes[i].cloneNode(true));
    }
  }

  function eq(itema, itemb) {
    return getKey(itema) === itemb;
  }

  function sort(newNode, oldNode) {

    KEY_STORE = []
    KEY_SEED = 0;

    var newKeyList = getKeyList(newNode)
      , oldKeyList = getKeyList(oldNode)
      , lcs = getLongestCommonSubsequence(newKeyList, oldKeyList)
      , shouldBeRemovedKeys = {}
      , pickedNode, refNode
      , refKey, refIndex
      , i, j, k;

    for (i = 0, j = 0; i < oldKeyList.length; i++) {
      if (oldKeyList[i] !== lcs[j]) {
        shouldBeRemovedKeys[oldKeyList[i]] = true;
      } else {
        j++;
      }
    }

    for (i = 0, j = 0; i < newKeyList.length; i++) {
      if (newKeyList[i] !== lcs[j]) {
        k = newKeyList[i];
        if (shouldBeRemovedKeys[k]) {
          shouldBeRemovedKeys[k] = false;
          pickedNode = oldNode.childNodes[getIndex(oldNode.childNodes, k, eq)]
        } else {
          pickedNode = newNode.childNodes[i].cloneNode(true);
          KEY_STORE.push([
            pickedNode,
            getKey(newNode.childNodes[i])
          ]);
        }

        if (i === 0) {
          refNode = oldNode.firstChild;
        } else {
          refKey = getKey(newNode.childNodes[i - 1]);
          refIndex = getIndex(oldNode.childNodes, refKey, eq);

          if (refIndex === -1) {
            throw "dinnerHTML: Logic Error.";
          }
          refNode = oldNode.childNodes[refIndex].nextSibling;
        }

        oldNode.insertBefore(pickedNode, refNode);
      } else {
        j++;
      }
    }

    for (k in shouldBeRemovedKeys) {
      if (shouldBeRemovedKeys.hasOwnProperty(k) && shouldBeRemovedKeys[k]) {
        oldNode.removeChild(oldNode.childNodes[getIndex(oldNode.childNodes, k, eq)]);
      }
    }

    KEY_STORE = []
    KEY_SEED = 0;
  }

  function getIndex(list, item, eq) {
    var i = 0;
    for (i = 0; i < list.length; i++) {
      if (eq(list[i], item)) {
        return i;
      }
    }
    return -1;
  }

  function getKeyList(node) {
    var i = 0
      , list = [];

    for (i = 0; i < node.childNodes.length; i++) {
      list.push(getKey(node.childNodes[i]));
    }
    return list;
  }

  function getKey(node) {
    var key = null
      , i = 0;

    for (i = 0; i < KEY_STORE.length; i++) {
      if (node === KEY_STORE[i][0]) {
        return KEY_STORE[i][1];
      }
    }

    if (node.nodeType === NODE_TYPE.ELEMENT_NODE) {
      key = [node.nodeType, node.attributes[KEY].nodeValue].join(";");
    } else {
      key = [node.nodeType, KEY_SEED++].join(";")
    }

    KEY_STORE.push([
      node,
      key
    ]);

    return key;
  }

  function hasKey(newNode, oldNode) {
    var i, db, key, newFound = false, oldFound = false;
    if (newNode && oldNode) {
      if (newNode.hasChildNodes() && oldNode.hasChildNodes()) {
        for (i = 0, db = {}; i < newNode.childNodes.length; i++) {
          if (newNode.childNodes[i].nodeType === NODE_TYPE.ELEMENT_NODE) {
            if (newNode.childNodes[i].hasAttribute(KEY)) {
              newFound = true;
            } else {
              return false;
            }
          }
          key = getKey(newNode.childNodes[i]);
          if (db[key]) {
            return false;
          } else {
            db[key] = true;
          }
        }

        for (i = 0, db = {}; i < oldNode.childNodes.length; i++) {
          if (oldNode.childNodes[i].nodeType === NODE_TYPE.ELEMENT_NODE) {
            if (oldNode.childNodes[i].hasAttribute(KEY)) {
              oldFound = true;
            } else {
              return false;
            }
          }
          key = getKey(oldNode.childNodes[i]);
          if (db[key]) {
            return false;
          } else {
            db[key] = true;
          }
        }

        return newFound && oldFound;

      }
    }
    return false;
  }

  function makeTable(rowSize, colSize, getPlaceholder) {
    var table = [], i, j;
    for (i = 0; i < rowSize; i++) {
      table[i] = [];
      for (j = 0; j < colSize; j++) {
        table[i][j] = getPlaceholder();
      }
    }
    return table;
  }

  function getLongestCommonSubsequence(lista, listb) {
    var rowSize = lista.length + 1
      , colSize = listb.length + 1
      , table = makeTable(rowSize, colSize, function () { return [] })
      , row = new Array(rowSize)
      , col = new Array(colSize)
      , cnt = 0, i, j, la, lb;

    row[0] = col[0] = null;

    for (i = rowSize - 2, cnt = 1; i >= 0; i-- , cnt++) {
      row[cnt] = lista[i];
    }
    for (i = colSize - 2, cnt = 1; i >= 0; i-- , cnt++) {
      col[cnt] = listb[i];
    }
    for (i = 1; i < rowSize; i++) {
      for (j = 1; j < colSize; j++) {
        if (row[i] === col[j]) {
          table[i][j] = [row[i]].concat(table[i - 1][j - 1]);
        } else {
          la = table[i - 1][j]
          lb = table[i][j - 1];
          table[i][j] = la.length < lb.length ? lb : la;
        }
      }
    }
    return table[rowSize - 1][colSize - 1];
  }

}());