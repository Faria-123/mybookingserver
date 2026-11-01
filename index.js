import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors'
import 'dotenv/config'
const app = express()
const PORT = 8000

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

app.use(cors())
app.use(express.json())


const mongoClient = await connectToMongoDB()
const db = mongoClient.db("mybook")
const books = db.collection("book")

app.post("/allbook", async (req, res) => {
  const data = req.body
  const result = await books.insertOne(data)
  res.send(result)
})

app.get('/allbook', async (req, res) => {
  const result = await books.find().toArray()
  res.send(result)
})

// app.get('/destination/:id', async(req, res) => {
//   const {id} = req.params
//   const result = await destinationCollection.findOne({_id: new ObjectId(id)})
//   res.send(result)
// })

// app.patch('/destination/:id', async(req, res) => {
//   const {id} = req.params
//   const data = req.body
//   const result = await destinationCollection.updateOne(
//     {_id: new ObjectId(id)}, 
//     {$set: data}
//   )
//   res.json(result)
// })

// app.delete('/destination/:id', async(req, res) => {
//   const {id} = req.params
//   const result = await destinationCollection.deleteOne({_id: new ObjectId(id)})
//   res.json(result)
// })




// Save a new book (cover image is uploaded separately to imgbb; only the URL is stored)
app.post('/add-book', async (req, res) => {
  try {
    const { title, author, category, image, description, userName, userEmail } = req.body ?? {}
    if (!title?.trim() || !author?.trim() || !category || !description?.trim()) {
      return res.status(400).send({ error: 'title, author, category and description are required' })
    }
    const book = {
      title: title.trim(),
      author: author.trim(),
      category,
      image: image ?? '',
      description: description.trim(),
      userName: userName ?? '',
      userEmail: userEmail ?? '',
      addedAt: new Date().toISOString(),
    }
    const result = await books.insertOne(book)
    res.status(201).send({ insertedId: result.insertedId, book })
  } catch (err) {
    console.error(err)
    res.status(500).send({ error: 'Failed to add book' })
  }
})


//http://localhost:8000

app.get('/', (req, res) => {
  res.send({ message: 'Server is running fine!' })
})

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`)
})