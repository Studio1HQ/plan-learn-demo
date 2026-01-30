# Finance Agent Web

This is the Next.js frontend for the Personal Finance Agent demo. It provides a user-friendly interface for interacting with the backend API, including a streaming chat interface, real-time alerts, and more.

## Features

-   **Streaming Chat**: Real-time response streaming from the agent, providing a seamless and interactive user experience.
-   **Usage Tracking**: Shows the number of remaining free messages, with a limit of 3 messages per user.
-   **API Key Input**: Prompts the user to enter their OpenAI API key after the free tier has been exhausted.
-   **Real-time Alerts**: Uses Server-Sent Events (SSE) to provide instant updates on financial alerts.
-   **AI-Generated Tips**: Allows users to request personalized financial suggestions from the agent.
-   **Sample Transactions**: Includes a list of pre-built transactions for demonstration purposes.

## Getting Started

### Prerequisites

-   Node.js 18 or later
-   pnpm (recommended)
-   Backend server running on `http://127.0.0.1:8000`

### Installation

```bash
cd finance-agent-web
pnpm install
```

### Development

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Technologies

-   **Next.js**: A popular React framework for building server-rendered applications.
-   **shadcn/ui**: A collection of re-usable UI components for building beautiful and accessible user interfaces.
-   **Server-Sent Events (SSE)**: A technology for pushing real-time updates from the server to the client.
-   **Vercel**: A platform for deploying and hosting Next.js applications.

## API Endpoints Used

| Endpoint                       | Method | Purpose                                  |
| ------------------------------ | ------ | ---------------------------------------- |
| `/api/chat`                    | POST   | Send message, receive streaming response |
| `/api/usage/{user_id}`         | GET    | Check free usage count                   |
| `/api/alerts/{user_id}`        | GET    | Fetch all alerts                         |
| `/api/alerts/{user_id}/stream` | GET    | SSE for real-time alerts                 |
| `/api/alerts/{user_id}/generate`| POST   | Generate AI suggestions                  |
| `/api/alerts/{alert_id}/acknowledge` | POST   | Dismiss an alert                         |
| `/api/transactions`            | POST   | Add a transaction                        |
| `/api/sample-transactions`     | GET    | Get sample transaction list              |
| `/api/sample-data/{user_id}`   | DELETE | Reset user data                          |