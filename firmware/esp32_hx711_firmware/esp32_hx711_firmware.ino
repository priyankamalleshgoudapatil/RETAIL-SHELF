/*
 * Smart-Retail Shelf Sensor Network - ESP32 & HX711 Hardware Firmware
 * -------------------------------------------------------------------
 * This sketch runs on an ESP32 microcontroller interfaced with an
 * HX711 24-bit ADC amplifier and 4-wire strain-gauge load cell (up to 5kg or 20kg).
 * 
 * Hardware Connections:
 *   ESP32 GPIO 16 (RX2) -> HX711 DOUT (Data Out)
 *   ESP32 GPIO 4  (D4)  -> HX711 SCK (Serial Clock)
 *   ESP32 3V3 / 5V      -> HX711 VCC
 *   ESP32 GND           -> HX711 GND
 * 
 * Load Cell to HX711:
 *   Red wire   -> E+ (Excitation +)
 *   Black wire -> E- (Excitation -)
 *   White wire -> A- (Signal -)
 *   Green wire -> A+ (Signal +)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // ArduinoJson library (v6 or v7)
#include "HX711.h"

// ----------------- Wi-Fi Credentials -----------------
const char* WIFI_SSID     = "RETAIL_STORE_WIFI";
const char* WIFI_PASSWORD = "StorePassword123";

// ----------------- Backend API Configuration -----------------
// Set to your laptop / backend server IP address and port
const char* SERVER_ENDPOINT = "http://192.168.1.100:5000/api/sensors/readings";
const char* SENSOR_ID       = "SEN-001";
const char* DEVICE_TOKEN    = "smart_retail_esp32_secret_token_2026"; // Must match X-Sensor-Key

// ----------------- HX711 Pin Configuration -----------------
const int LOADCELL_DOUT_PIN = 16;
const int LOADCELL_SCK_PIN  = 4;

HX711 scale;

// Calibration factor: Determined during the two-point calibration step
// Adjust this factor until the weight in grams matches a known test weight
float calibration_factor = 420.5; 

// Reporting interval (milliseconds)
const unsigned long REPORTING_INTERVAL_MS = 5000;
unsigned long lastTransmissionTime = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Smart-Retail ESP32 Shelf Sensor Starting ---");
  Serial.printf("Sensor ID: %s\n", SENSOR_ID);

  // Initialize HX711 Load Cell Interface
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  scale.set_scale(calibration_factor);

  Serial.println("Taring scale platform... ensure shelf platform is empty.");
  delay(2000);
  scale.tare(); // Reset scale to 0
  Serial.println("Tare complete. Platform zeroed.");

  // Connect to Wi-Fi Network
  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.printf("[WiFi] Assigned IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WiFi] Connection timed out. Will retry during loop.");
  }
}

void loop() {
  unsigned long currentTime = millis();

  // Transmit telemetry at designated interval
  if (currentTime - lastTransmissionTime >= REPORTING_INTERVAL_MS) {
    lastTransmissionTime = currentTime;

    if (scale.is_ready()) {
      // Read average of 5 measurements for mechanical stability
      float measuredWeightGrams = scale.get_units(5);
      if (measuredWeightGrams < 0) {
        measuredWeightGrams = 0.0; // Floor zero
      }

      Serial.printf("[Sensor] Measured Weight: %.1f g\n", measuredWeightGrams);
      sendTelemetryReading(measuredWeightGrams);
    } else {
      Serial.println("[Sensor Error] HX711 not ready or disconnected!");
    }
  }

  delay(50);
}

void sendTelemetryReading(float weightGrams) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Wi-Fi not connected. Skipping packet.");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Sensor-Key", DEVICE_TOKEN);

  // Construct JSON payload
  StaticJsonDocument<256> doc;
  doc["sensorId"] = SENSOR_ID;
  doc["weightGrams"] = round(weightGrams * 10.0) / 10.0;
  doc["source"] = "HARDWARE";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP %d] Server Response: %s\n", httpResponseCode, response.c_str());
  } else {
    Serial.printf("[HTTP Error] Failed to send POST, code: %d, error: %s\n", 
                  httpResponseCode, http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
