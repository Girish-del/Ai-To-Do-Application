import { db } from './db/index.js';
import { todosTable } from './db/schema.js';
import { ilike, eq } from 'drizzle-orm';
import { real } from 'drizzle-orm/mysql-core';
import OpenAI from 'openai';
import readlineSync from 'readline-sync';

// const openai = new OpenAI(); Documentation line
const client = new OpenAI();

async function getAllTodos() {
    const todos = await db.select().from(todosTable);
    return todos;
}

async function createTodo(todo) {
    const [result] = await db.insert(todosTable).values({
        todo,
    }).returning({
        id: todosTable.id,
    });
    return result.id;
}

async function deleteTodoById(id) {
    await db.delete(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(search) {
    const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
    return todos;
}

// Created a mapping function "tool" to map all the tools/functions. 
const tools = {
    getAllTodos: getAllTodos,
    createTodo: createTodo,
    deleteTodoById: deleteTodoById,
    searchTodo: searchTodo,
};

const SYSTEM_PROMPT = `

You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation and Output State. 
Wait for the user prompt and first PLAN using avaibale tools. 
After Planning, Take the action with appropriate tools and wait for Observation based on Action. 
Once you get the Observations, Return the AI response based on the START prompt and observations. 

You can manage tasks by adding, viewing, updating and deleting them. 
You must strictly follow the JSON output format. 

Todo DB Schema: 
id: Int and Primary key
todo: String 
created_at: Date Time
updated_at: Date Time

Available Tools: 
- getAllTodos(): Returns all the Todos from the Database
- createTodo(todo: string): Creates a new Todo in the DB and takes todo as a String and returns the ID of the created todo  
- deleteTodoById(id: string): Deletes the todo by ID given in the DB
- searchTodo(query: String): Searches for all the todos matching the query string using ilike operator in DB

Example: 
START
{"type": "user", "user": "Add a task for shopping groceries."}
{"type": "plan", "plan": "I will try to get more context on what user needs to shop."}
{"type": "output", "output": "Can you tell me what all items you want to shop for?"}
{"type": "user", "user": "I want to shop for milk, kurkure, lays and chocolate."}
{"type": "plan", "plan": "I will user createTodo to create a new Todoin DB."}
{"type": "action", "function": "createTodo", "input": "Shopping for milk, kurkure, lays and chocolate."}
{"type": "observation", "observation": "2"}
{"type": "output", "output": "Your todo has list has been added successfully."}
`;

const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

while (true) {
    const query = readlineSync.question('>>');
    const userMessage = {
        type: 'user',
        user: query,
    };
    messages.push({ role: 'user', content: JSON.stringify(userMessage) });

    while (true) {
        const chat = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            response_format: { type: 'json_object' },
        });
        const result = chat.choices[0].message.content;
        messages.push({ role: 'assistant', content: result });

        console.log(`\n\n------------START AI----------`)
        console.log(result);
        console.log(`\n\n------------END AI----------`)

        const action = JSON.parse(result);

        if (action.type === 'output') {
            console.log(`${action.output}`);
            break;
        }
        else if (action.type === 'action') {
            const fn = tools[action.function];
            if (!fn) throw new Error('Invalid Tool Call');
            const observation = await fn(action.input);
            const observationMessage = {
                type: 'observation',
                observation: observation,
            };
            messages.push({ role: 'developer', content: JSON.stringify(observationMessage) });
        }

    }
}