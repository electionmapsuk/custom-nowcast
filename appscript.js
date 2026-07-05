// --- CONFIGURATION ---
const CACHE_DURATION = 900;     // 15 minutes
const CACHE_CHUNK_SIZE = 90000; // 90KB chunks, safely under the 100KB limit

function doGet(e) {
  try {
    var sheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : 'Sheet1';
    var cacheKey  = "poll_data_v6_" + sheetName.replace(/\s+/g, "_");

    // 1. TRY CACHE (chunked read)
    var data = readFromCache(cacheKey);

    // 2. CACHE MISS — read sheet
    if (data === null) {
      data = getSheetData(sheetName);
      writeToCache(cacheKey, data);
    }

    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Chunked cache read ──────────────────────────────────────────────────────
// Reassembles a value split across multiple cache keys.
// Returns null on any miss so the caller knows to re-fetch.
function readFromCache(baseKey) {
  var cache = CacheService.getScriptCache();
  var meta  = cache.get(baseKey + "_meta");
  if (meta === null) return null;

  var chunks = parseInt(meta, 10);
  var parts  = [];
  for (var i = 0; i < chunks; i++) {
    var part = cache.get(baseKey + "_" + i);
    if (part === null) return null; // incomplete — treat as miss
    parts.push(part);
  }
  return JSON.parse(parts.join(""));
}

// ── Chunked cache write ─────────────────────────────────────────────────────
// Splits large JSON strings into ≤90KB chunks before storing.
function writeToCache(baseKey, data) {
  try {
    var cache      = CacheService.getScriptCache();
    var jsonString = JSON.stringify(data);
    var chunks     = [];

    for (var i = 0; i < jsonString.length; i += CACHE_CHUNK_SIZE) {
      chunks.push(jsonString.substring(i, i + CACHE_CHUNK_SIZE));
    }

    var toStore = {};
    toStore[baseKey + "_meta"] = String(chunks.length);
    chunks.forEach(function(chunk, idx) {
      toStore[baseKey + "_" + idx] = chunk;
    });

    cache.putAll(toStore, CACHE_DURATION);
  } catch (err) {
    // Cache write failed — not fatal, the response will still be returned
    console.warn("Cache write failed: " + err);
  }
}

// ── Sheet reader ────────────────────────────────────────────────────────────
function getSheetData(sheetName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet '" + sheetName + "' not found");

  // getDisplayValues() returns values exactly as they appear in the sheet
  // (e.g. "19%" not 0.19, dates as formatted strings not Date objects).
  // This is important for sheets that store percentages as decimals with % formatting.
  var data    = sheet.getDataRange().getDisplayValues();
  var headers = data[0];
  var rows    = data.slice(1);
  var target  = sheetName.toString().trim().toLowerCase();

  return rows
    .filter(function(row) {
      // Skip completely empty rows
      return row.some(function(cell) { return cell !== "" && cell !== null; });
    })
    .map(function(row) {
      var record = {};
      row.forEach(function(cell, index) {

        if (target === "approval") {
          if      (index === 0) record["startdate"] = cell;
          else if (index === 1) record["enddate"]   = cell;
          else if (index === 2) record["pollster"]  = cell;
          else if (index === 3) record["weight"]    = cell;
          else if (index === 4) record["wording"]   = cell;
          else {
            var h = headers[index] ? headers[index].toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '') : "unknown";
            record[h] = cell;
          }
        } else {
          var header = headers[index] ? headers[index].toString().trim() : "Unknown";
          record[header] = cell;
        }
      });
      return record;
    });
}

// ── Pre-warm trigger ────────────────────────────────────────────────────────
// Run this once manually to install a trigger that keeps the cache hot.
// After running, a trigger appears in Apps Script → Triggers.
function installPreWarmTrigger() {
  // Delete any existing pre-warm triggers first
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "preWarmCache") {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Re-run every 10 minutes (well within the 15-minute cache window)
  ScriptApp.newTrigger("preWarmCache")
    .timeBased()
    .everyMinutes(10)
    .create();
}

// Refreshes the cache for all sheets you serve.
// Add/remove sheet names to match your deployment.
function preWarmCache() {
  var sheetsToWarm = ["Sheet1", "Approval"];
  var baseKey;
  sheetsToWarm.forEach(function(name) {
    try {
      var data = getSheetData(name);
      baseKey  = "poll_data_v6_" + name.replace(/\s+/g, "_");
      writeToCache(baseKey, data);
      console.log("Pre-warmed: " + name);
    } catch (err) {
      console.warn("Pre-warm failed for " + name + ": " + err);
    }
  });
}
