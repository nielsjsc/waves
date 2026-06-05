# waves

Waves is an app to help orienteering event hosts keep interval starts running smoothly.

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
In an *administrator* cmd, `start nginx`
(and then can use `nginx -s reload` and `nginx -s quit`)

5. Start waves-app

In the waves-app folder, run `pnpm dev`
(you may need to run `pnpm install` first)

6. Update your Hosts file or DNS

app.waves.local and server.waves.local should resolve to the IP where both vite and express/rx-server are running.
Make sure you've added trust for the CA certificate on this machine.

7. Open a browser to `https://app.waves.local`
