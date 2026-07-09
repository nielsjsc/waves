# waves

Waves is an app to help orienteering event hosts keep interval starts running smoothly.

## Usage

### Participant States

Participants always exist in exactly one of the following states:
`waiting`, `present`, `validated`, `noShow`, `notAttending`, and `needsAssignment`.

The initial state for a participant is either **waiting** (for those with a pre-assigned start time) or **needsAssignment** (for those who do not have a start time).
The call-up volunteer can mark a participant as **present** when they arrive at call-up.
The call-up volunteer can also mark a participant as **noShow** if they are not present at call-up.

The epunch check volunteer will mark a participant as **validated** when they've confirmed that the epunch number in the system matches the epunch number the participant is holding.
For v1 of this tool, **validated** is the final state for a participant. (Future versions may track states like "started", "finished", and "downloaded".)

The start manager can set a participant as **notAttending**, which automatically frees up that participant's slot if they had one assigned.

The start manager can set a participant as **needsAssignment** to indicate that a participant (perhaps someone who missed their start time and was set as a No-Show) needs a new time. When the start manager assigns a new start time, the participant is moved back to the **waiting** state.

### Rules

To be in waiting, present, validated, or noShow state, the participant must have a real start time.
To be in notAttending, the participant must be in the _notAttending start time.
To be in needsAssignment, the participant must be in the _needsAssignment start time.









### Slots / Start Times

Start times don't actually have a concept of time, they're just a string that looks like a time. 
A `Slot` is the combination of a `Course` and a `Start Time`. While typically there would be zero or one participant in a given slot, Waves allows for multiple participants to occupy a slot. 
One reason for this is that there are two "magic" start times: `_notAttending` and `_needsAssignment`.



## Developing

### Starting the app locally

0. Prerequisites

Create a Root CA Certificate
Create a server certificate and sign it with that root CA
Install the Root CA in your brower's trusted CA's list
set the path to the server cert and key in both app > vite.config.ts AND server > server.ts

Install MongoDB

Install nginx and update the config based on the file included with waves-server 

1. Start MongoDB background service

In any `cmd` run the following:
`"C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --dbpath="C:\MongoDB" --bind_ip="127.0.0.1" --port="27017" --replSet="rs0"`

2. Verify the MongoDB replication set

Open `mongosh` 
If the prompt already starts with `rs0`, you're good to go. 
If not, run `rs.initiate({ _id: "rs0", members: [ { _id: 0, host: "localhost:27017" }] })`

3. Start waves-server

In the waves-server folder, run `npx ts-node server.ts`
This should display output with the last line being `started rx-server`

4. Start nginx 
In an *administrator* cmd (or maybe not???), `start nginx`
(and then can use `nginx -s reload` and `nginx -s quit`)

5. Start waves-app

In the waves-app folder, run `pnpm dev`
(you may need to run `pnpm install` first)

6. Update your Hosts file or DNS

app.waves.local and server.waves.local should resolve to the IP where both vite and express/rx-server are running.
Make sure you've added trust for the CA certificate on this machine.

7. Open a browser to `https://app.waves.local`


### Data Model

Every Participant should be present in exactly one slot at all times.
A slot can have multiple participants, but a participant should only ever be in one slot.
Becuase a slot is for a specific time and specific course, there are also "special" slots to handle states where a start time is not yet assigned. Special times use the same value as participant states, preceded by an underscore.
"_notAttending"
"_needsAssignment"

### Update Schema without Migration
To update the schema without a migration:
after updating in BOTH App>{Collection}.ts and Server>Server.ts
stop the web app and the server
in MongoDB Compass UI, delete both `wavesServerDb-v0` and `wavesmongodb`
***in every browser, delete IndexedDB storage***
restart everything, reload the browser page.

