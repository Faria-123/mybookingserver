import express from 'express'
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors'
import 'dotenv/config'
import { createRemoteJWKSet, jwtVerify } from 'jose';
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


const mongoClient = await connectToMongoDB();
const db = mongoClient.db("mybook");
const books = db.collection("book");
const borrows = db.collection("borrows");
const VerifyApi = async (req, res, next) => {
  const authorizedHeader = req.headers.authorization;
  // console.log("Authorized Header:", authorizedHeader);

  if (!authorizedHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authorizedHeader.split(' ')[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  }
  catch (error) {
    return res.status(500).send({ message: "something went wrong" });
  }

}
console.log(
  await books.findOne({
    _id: new ObjectId("6ae58cdee8accdf0f3ed0486")
  })
);

app.post("/allbook", VerifyApi, async (req, res) => {
  const data = req.body
  const result = await books.insertOne(data)
  res.send(result)
})

app.post("/borrow-book", async (req, res) => {
  try {
    const {
      bookId,
      bookTitle,
      userId,
      userName,
      userEmail,
    } = req.body;

    if (!bookId || !userId || !userEmail) {
      return res.status(400).send({
        message: "Required information is missing",
      });
    }

    if (!ObjectId.isValid(bookId)) {
      return res.status(400).send({
        message: "Invalid book ID",
      });
    }

    // Check whether the book exists
    const book = await books.findOne({
      _id: new ObjectId(bookId),
    });

    if (!book) {
      return res.status(404).send({
        message: "Book not found",
      });
    }

    // Prevent duplicate active borrowing
    const alreadyBorrowed = await borrows.findOne({
      bookId,
      userId,
      status: "borrowed",
    });

    if (alreadyBorrowed) {
      return res.status(409).send({
        message: "You have already borrowed this book",
      });
    }
    // Borrow date
    const borrowedAt = new Date();

    // Return date (7 days after borrowing)
    const returnDate = new Date(borrowedAt);
    returnDate.setDate(returnDate.getDate() + 7);

    const borrowData = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userId,
      userName: userName || "",
      userEmail,
      borrowedAt,
      returnDate,
      status: "borrowed",
    };

    const result = await borrows.insertOne(borrowData);

    res.status(201).send({
      message: "Book borrowed successfully",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to borrow book",
    });
  }
});


app.get("/my-borrows/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await borrows
      .find({
        userId,
        status: "borrowed",
      })
      .sort({ borrowedAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});


app.patch("/return-book/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid borrow ID",
      });
    }

    const result = await borrows.updateOne(
      {
        _id: new ObjectId(id),
        userId,
        status: "borrowed",
      },
      {
        $set: {
          status: "returned",
          returnedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        message: "Borrow record not found",
      });
    }

    res.send({
      message: "Book returned successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});


app.get('/allbook', async (req, res) => {
  const result = await books.find().toArray()
  res.send(result)
})
app.get("/allbook/:email", VerifyApi, async (req, res) => {
  const { email } = req.params
  const result = await books.find({ userEmail: email }).toArray();
  res.send(result);
})



app.get("/allbook/details/:id", VerifyApi, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ID" });
    }

    const result = await books.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// app.patch('/destination/:id', async(req, res) => {
//   const {id} = req.params
//   const data = req.body
//   const result = await destinationCollection.updateOne(
//     {_id: new ObjectId(id)}, 
//     {$set: data}
//   )
//   res.json(result)
// })

// app.delete("/allbook/details/:id", async (req, res) => {
//   const { id } = req.params
//   const result = await destinationCollection.deleteOne({ _id: new ObjectId(id) })
//   res.json(result)
// })

app.delete("/allbook/details/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ID" });
    }

    const result = await books.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send({ message: "Book deleted successfully" });

  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});
app.put("/allbook/details/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book ID" });
    }

    const { title, author, category, image, description } = req.body;

    const result = await books.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          title: title.trim(),
          author: author.trim(),
          category,
          image: image.trim(),
          description: description.trim(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send({ message: "Book updated successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});



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
export default app