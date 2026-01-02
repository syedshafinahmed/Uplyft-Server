const express = require("express");
const cors = require("cors");
const app = express();
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
const port = process.env.PORT || 3000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      message: "Unauthorized Access. Token not found!",
    });
  }
  const token = authorization.split(" ")[1];
  try {
    await admin.auth().verifyIdToken(token);
    next();
  } catch (error) {
    res.status(401).send({
      message: "Unauthorized Access",
    });
  }
  // console.log();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("event-db");
    const eventCollection = db.collection("events");
    const joinedCollection = db.collection("joined");

    app.get("/events", async (req, res) => {
      try {
        const { type, search } = req.query;
        const matchQuery = {};
        matchQuery.parsedDate = { $gte: new Date() };
        const pipeline = [
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
        ];
        if (type) {
          pipeline.push({
            $match: { event_type: type },
          });
        }
        if (search) {
          pipeline.push({
            $match: {
              title: { $regex: search, $options: "i" },
            },
          });
        }
        pipeline.push({
          $match: { parsedDate: { $gte: new Date() } },
        });
        pipeline.push({ $sort: { parsedDate: 1 } });
        pipeline.push({ $project: { parsedDate: 0 } });
        const events = await eventCollection.aggregate(pipeline).toArray();
        res.send(events);
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

    app.get("/events/user/:email", verifyToken, async (req, res) => {
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

    app.get("/joined/:email", verifyToken, async (req, res) => {
      const { email } = req.params;
      try {
        const joinedEvents = await joinedCollection
          .aggregate([
            { $match: { user_email: email } },
            {
              $addFields: {
                parsedDate: { $dateFromString: { dateString: "$event_date" } },
              },
            },
            { $sort: { parsedDate: 1 } },
            { $project: { parsedDate: 0 } },
          ])
          .toArray();

        res.status(200).json(joinedEvents);
      } catch (error) {
        console.error("Error fetching joined events:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch joined events", error });
      }
    });

    app.post("/joined", async (req, res) => {
      const data = req.body;

      try {
        const existing = await joinedCollection.findOne({
          user_email: data.user_email,
          eventId: data.eventId,
        });

        if (existing) {
          return res.status(400).send({ message: "Already joined this event" });
        }
        const result = await joinedCollection.insertOne(data);
        res.send({ success: true, result });
      } catch (error) {
        console.error("Error joining event:", error);
        res.status(500).send({ message: "Failed to join event", error });
      }
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

    // Get events by type
    app.get("/events/type/:event_type", async (req, res) => {
      const { event_type } = req.params;
      try {
        const events = await eventCollection
          .find({ event_type })
          .sort({ event_date: 1 }) // upcoming events first
          .toArray();
        res.send(events);
      } catch (error) {
        console.error("Error fetching events by type:", error);
        res.status(500).send({ message: "Failed to fetch events by type" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
