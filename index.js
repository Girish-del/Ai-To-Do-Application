import {db} from './db';
import {todosTable} from './db/schema';
import {ilike, eq} from 'drizzle-orm';
import OpenAI from 'openai';
import readlineSync from 'readline-sync';

// const openai = new OpenAI(); Documentation line
const client = new OpenAI();

async function getAllTodos(){
    const todos = await db.select().from(todosTable);
    return todos;
}

async function createTodo(todo){
    const [todo] = await db.insert(todosTable).values({
        todo,
    }).returning({
        id: todosTable.id,
    });
    return todo.id;
}

async function deleteTodoById(id){
    await db.delete(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(search){
    const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, search));
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

const messages = [{role: 'system', content: SYSTEM_PROMPT}];