#!/usr/bin/env node
const newrelic = require('newrelic');
const TuyAPI = require('tuyapi');
const config = require('./config');

var mqtt = require('mqtt');
var client  = mqtt.connect(config.mqtt_server)

let deviceStatus = false;
let samples = [];

client.on('message', function (topic, message) {
    samples.push(parseFloat(message.toString()));
    controlTemp();
});

function controlTemp()
{
    if(samples.length < config.sample_size)
        return;
    if(!device.isConnected())
        return;

    let total = 0;
    let min = 100;
    let max = 0;
    for(let i = 0; i < samples.length; i++) {
        if(samples[i] < min)
            min = samples[i];
        if(samples[i] > max)
            max = samples[i];
        total += samples[i];
    }
    let avg = total / samples.length;
    samples = [];

    console.log("Avg min/max temp: " + avg);
    console.log("Min temp: " + min);
    console.log("Max temp: " + max);
    if(parseFloat(avg) < config.target_temperature) {
        if(!deviceStatus){
            console.log("Turning on device...");
            device.set({set: true});
            const attributes = {
                status: true
            }
        }
    } else {
        if(deviceStatus) {
            console.log("Turning off device...");
            device.set({set: false});
            const attributes = {
                status: false
            }
        }
    }

    const attributes = {
        minimum: min,
        maximum: max,
        average: avg,
        target: config.target_temperature, 
        device_status: deviceStatus
    }
    newrelic.recordCustomEvent("HeaterEvent", attributes);
}

const device = new TuyAPI({
    ip: config.smart_plug_ip,
    id: config.smart_plug_id,
    key: config.smart_plug_key});

client.on('connect', function () {
    client.subscribe('temperature')
});

// Find device on network
function reconnect() {
    device.find().then(() => {
        // Connect to device
        device.connect();
    });
}

reconnect();

// Add event listeners
device.on('connected', () => {
  console.log('Connected to device!');
});

device.on('disconnected', () => {
  console.log('Disconnected from device.');
  setTimeout(reconnect, 3000);
});

device.on('error', error => {
  console.log('Error!', error);
  setTimeout(reconnect, 3000);
});

device.on('data', data => {
  deviceStatus = data.dps['1'];
});