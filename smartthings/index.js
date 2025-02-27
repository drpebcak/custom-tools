const {SmartThingsClient, BearerTokenAuthenticator, Command} = require('@smartthings/core-sdk')

const command = process.argv[2]
let token = process.env.SMARTTHINGS_OAUTH_TOKEN
let tokenType = "bearer"
if (token === undefined || token === "") {
    token = process.env.SMARTTHINGS_API_TOKEN
    tokenType = "token"
}

const st = new SmartThingsClient(new BearerTokenAuthenticator(token))

async function main() {
    console.log(`Executing ${command}`)
    const deviceId = process.env.DEVICE_ID
    switch (command) {
        case "listDevices":
            await listDevices(st)
            break
        case "toggleDevice":
            const state = process.env.STATE
            const capability = process.env.CAPABILITY
            await toggleDevice(st, deviceId, capability, state)
            break
        case "getDeviceInfo":
            await getDeviceInfo(st, deviceId)
            break
    }
}

async function listDevices(st) {
    const devices = await st.devices.list()
    console.log(`Found ${devices.length} devices`)
    for (device of devices) {
        let roomName;
        try {
            const room = await st.rooms.get(device.roomId, device.locationId)
            roomName = room.name
        } catch (error) {
            roomName = "None"
        }
        let deviceId = "None";
        if (device.deviceId !== "undefined") {
            deviceId = device.deviceId
        }
        console.log(`Device "${device.label}" in Room "${roomName}" with deviceID "${deviceId}"`)
    }
}

async function toggleDevice(st, deviceId, capability, state) {
    const command = {
        component: 'main', capability: capability, command: state
    }
    await st.devices.executeCommand(deviceId, command)
}

async function getDeviceInfo(st, deviceId) {
    const device = await st.devices.get(deviceId)
    console.log(`Device: ${device.label} (${deviceId})`)
    console.log(`Type: ${device.name}`)
    console.log(`LocationId: ${device.locationId}`)

    console.log(`Capabilities:`)
    for (capability of device.components[0].capabilities) {
        let value = "";
        const ignoreCapability = new Set(["mediaInputSource", "ocf", "firmwareUpdate", "codeLength", "refresh", "maxCodes", "maxCodeLength", "codeChanged", "minCodeLength", "codeReport", "scanCodes", "lockCodes"])
        if (ignoreCapability.has(capability.id)) {
            continue
        }
        let capabilityStatus;
        const retries = 3
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                capabilityStatus = await st.devices.getCapabilityStatus(deviceId, 'main', capability.id)
                break
            } catch (error) {
                if (error.response.status === 429) {
                    const retryAfter = getRetryTime(error);
                    await new Promise(res => setTimeout(res, retryAfter));
                } else {
                    console.error(`  ${capability.id} = Unable to retrieve Capability Status`)
                    continue
                }
            }
            if (attempt === retries - 1) {
                value = "Unable to retrieve Capability Status"
            }
        }

        const matchingCapability = new Set(["switch", "lock", "battery"])
        if (value === "") {
            if (capability.id === "switchLevel") {
                value = capabilityStatus['level'].value
            } else if (matchingCapability.has(capability.id)) {
                value = capabilityStatus[capability.id].value
            } else {
                value = JSON.stringify(capabilityStatus)
            }
        }
        console.log(`  ${capability.id} = ${value}`)
    }
}

function getRetryTime(error) {
    const headers = error.response?.headers || {};

    // x-ratelimit-reset provides a timestamp (in seconds since epoch)
    if (headers['x-ratelimit-reset']) {
        const resetTime = parseInt(headers['x-ratelimit-reset'], 10) * 1000;
        const currentTime = Date.now();
        return Math.max(resetTime - currentTime, 1000);
    }

    // retry-after gives the wait time directly in seconds
    if (headers['retry-after']) {
        return parseInt(headers['retry-after'], 10) * 1000;
    }

    return 5000;
}

main()

