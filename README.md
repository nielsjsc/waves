# waves

Waves is an app to help orienteering event hosts keep interval starts running smoothly.

## Developing

### Starting the app locally

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

4. Start waves-app

In the waves-app folder, run `pnpm dev`
(you may need to run `pnpm install` first)
This will start the application and open a browser to localhost:5173
