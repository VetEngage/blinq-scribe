# Blinq Scribe for iPhone

Companion app for Meta AI glasses. The vet wears the glasses and keeps the phone in a pocket. The app records the exam through the glasses mic, takes photos, speaks short confirmations through the glasses speakers, and asks the day assistant questions. Review, edit and signing stay in the web console.

The app only talks to the Blinq Scribe server over HTTPS. It never calls Telnyx, VetEngage or the Meta Model API directly.

Requires iOS 17.2 or later (the toolkit's minimum) and Xcode 26.4 or later.

## Build in one sitting

1. Start the server on your laptop.

```bash
cd server
pip install -r requirements.txt
uvicorn blinqscribe.main:app --reload --host 0.0.0.0 --port 8000
```

Find the laptop IP on the same Wi-Fi (for example 192.168.1.10). The app default server URL is http://192.168.1.10:8000.

2. Open the project.

```bash
open glasses-ios/BlinqScribe.xcodeproj
```

3. Set signing. Select the BlinqScribe target, then Signing and Capabilities. Pick your Apple ID team. A free Apple ID works. The install expires after 7 days, so reinstall from Xcode before a demo. Change the bundle ID if Xcode asks for a unique one.

4. Set the Wearables app ID. The app needs an app ID from the Wearables Developer Center at https://wearables.developer.meta.com/. In Xcode, select the BlinqScribe target, then Build Settings. Set the user defined setting MWDAT_APP_ID to your app ID. Never commit a real app ID. With Developer Mode on in the Meta AI app you can leave it empty while testing. The value reaches Info.plist as MWDAT MetaAppID through the build setting, it is not hard coded in source.

5. Run on a phone or the simulator. Pick an iPhone destination and press Run. On the simulator there is no Bluetooth or glasses, so use the phone mic and phone camera, plus the mock device below.

## Connect your glasses

Do this once per phone.

1. Pair the glasses in the Meta AI app. Check the glasses software is current: Devices tab, your glasses, the gear icon, General, About, Version.
2. Turn on Developer Mode in the Meta AI app: Settings, App Info, tap the app version number five times, turn on the Developer Mode switch, then tap Enable. This lets an app that isn't in the App Store connect to your glasses.
3. In Blinq Scribe, open Settings and tap Connect glasses. The Meta AI app opens. Approve Blinq Scribe, and the Meta AI app sends you back through the `blinqscribe://` link. Settings then shows Connected with the glasses' name and battery.
4. Blinq Scribe now shows in the Meta AI app under App connections, Developer mode apps. Disconnect glasses in Settings removes it.
5. The first photo asks for camera permission on the glasses.

The mic and speakers need no extra step. The app uses the glasses as a Bluetooth headset (HFP) through the iPhone's audio session, so recording and spoken replies use the glasses whenever they're connected.

If Settings says the glasses need an update, tap Update glasses software. It opens the update screen in the Meta AI app.

## Test connection and mock device

Open Settings in the app. Check the server URL and the optional API token. The URL is saved in UserDefaults. The token is saved in the Keychain. Tap Test connection. It calls GET /health and shows the AI, practice, speech, SAM and text status.

In debug builds, Settings shows a Mock device switch. Turn it on to use MockDeviceKit from the Meta Wearables Device Access Toolkit. It pairs a simulated Ray-Ban Meta device, powers it on and puts it on, so camera and session code can be tested without glasses. The Swift package is https://github.com/facebook/meta-wearables-dat-ios pinned to an exact version tag in the project. No app ID is needed for the mock device.

## Use it

Today shows the morning brief and the schedule. Tap Morning brief to hear it through the glasses speakers. Tap an appointment to open the visit and hear the pre-room card.

On the visit screen, turn on Owner agreed to recording, then tap Owner agreed: start visit. Recording is not possible before the visit starts. Tap Record to record from the glasses mic over Bluetooth HFP. The screen shows which mic is active: glasses or phone. Audio is cut into 15 second WAV chunks at 16 kHz mono and uploaded. Tap Capture photo for a glasses photo, with an optional hint. If the glasses camera is not available the app says so and opens the phone camera through the same upload. Tap Write the note, then review it in the web console. Use Ask to ask the day assistant by text, or push to talk by voice.

Spoken confirmations come through the active audio route: Visit started, Recording, Recording stopped, Photo saved, and the note drafted message. Keep recording when the screen locks works through the audio background mode.

## Tests

```bash
xcodebuild -project glasses-ios/BlinqScribe.xcodeproj -scheme BlinqScribe -destination 'platform=iOS Simulator,name=iPhone 16' build test
```

If the simulator is not available, a compile check with CODE_SIGNING_ALLOWED=NO and a generic iOS destination proves the code builds. The tests cover WAV header bytes, 16 kHz mono format, chunk size, the final partial chunk, and client request shapes against a URLProtocol stub.

## Notes

Analytics and crash reporting from the toolkit are opted out in Info.plist under MWDAT. The app talks only to the Blinq Scribe server. No keys, tokens or phone numbers are in the repo.
