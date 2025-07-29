import express from "express";
import http from "http";
import bodyParser from "body-parser";
import axios from "axios";
import cors from "cors";
import { readFile, writeFile } from "fs/promises";

const token = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjU0MzgzNzUzOCwiYWFpIjoxMSwidWlkIjo3ODU5NzQwMCwiaWFkIjoiMjAyNS0wNy0yOFQxMzozMDo1My4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MzA0NTQ1OTYsInJnbiI6ImV1YzEifQ.3n79fspVbwOakpUOfdNkSyXuD7CCiV9Inoo02UfUYyo"
const app = express();
const server = http.createServer(app);
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

const getValueByType = (type, value) => {
    switch (type) {
        case "status":
            return value.label.text;
        case "text":
        case "long_text":
            return value.value;
        default:
            return value.label.text;
    }
}

app.post("/save-column-mapping", async function (req, res) {

    const columnMapping = req.body;
    console.log("Received column mapping:", columnMapping);
    readFile("column-mapping.json", "utf8")
        .then(data => {
            const existingMapping = JSON.parse(data);
            const exist = existingMapping.find(item => item.from.value === columnMapping.from.value && item.to.value === columnMapping.to.value);

            if (!exist) {
                existingMapping.push(columnMapping);
                return writeFile("column-mapping.json", JSON.stringify(existingMapping, null, 2));
            }
        })
        .then(() => {
            console.log("Column mapping saved successfully.");
            res.status(200).send({ message: "Column mapping saved successfully." });
        })
        .catch(err => {
            console.error("Error saving column mapping:", err);
            res.status(500).send({ error: "Failed to save column mapping." });
        });
})

app.post("/", function (req, res) {
    if (req.body.challenge) {
        return res.status(200).send({ challenge: req.body.challenge });
    }

    const data = req.body;
    console.log("Received request body:", JSON.stringify(data));

    readFile("column-mapping.json", "utf8")
        .then(fileData => {
            const columnMapping = JSON.parse(fileData);
            console.log("Column mapping loaded:", columnMapping);
            const target_column = columnMapping.find(item => item.from.value === data.event.columnId)?.to.value;
            
            if (target_column) {
                console.log("Target column found:", target_column);
                const value = getValueByType(data.event.columnType, data.event.value);
                const mutation = `
                    mutation {
                        change_simple_column_value(
                            item_id: ${data.event.pulseId}
                            board_id: ${data.event.boardId}
                            column_id: "${target_column}"
                            value: "${value}"
                            create_labels_if_missing: true
                            )
                        {
                            id
                        }}
                `;
                console.log("Mutation query:", mutation);
                axios.post('https://api.monday.com/v2', { query: mutation },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: token
                        }
                    }
                ).then(response => {
                    console.log("Mutation response:", response.data);
                }).catch(error => {
                    console.error("Error in mutation:", error.message);
                });

            }
        })

    res.status(200).send(req.body);
}
)

server.listen(process.env.PORT || 3000, function () {
    console.log('Express server listening on port 3000.');
})