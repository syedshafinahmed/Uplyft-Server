const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@zyra.l75hwjs.mongodb.net/?appName=Zyra`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("event-db");
    const eventCollection = db.collection("events");

    app.get("/events", async (req, res) => {
      try {
        const result = await eventCollection
          .aggregate([
            {
              $addFields: {
                parsedDate: {
                  $dateFromString: {
                    dateString: "$event_date",
                    timezone: "Asia/Dhaka",
                  },
                },
              },
            },
            { $match: { parsedDate: { $gte: new Date() } } },
            { $sort: { parsedDate: 1 } },
            {
              $project: {
                parsedDate: 0,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Error fetching events" });
      }
    });

    app.get("/events/:id", async (req, res) => {
      const { id } = req.params;
      const result = await eventCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/events/user/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const events = await eventCollection
          .find({ created_by: email })
          .toArray();
        res.send(events);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch events", error });
      }
    });

    app.post("/events", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await eventCollection.insertOne(data);
      res.send({
        success: true,
        result,
      });
    });

    app.put("/events/:id", async (req, res) => {
      const { id } = req.params;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: data,
      };
      const result = await eventCollection.updateOne(filter, update);
      res.send({
        success: true,
        result,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
