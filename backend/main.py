import uvicorn


def main():
    # uv run uvicorn app.main:app --reload
    print("Hello from backend!")
    uvicorn.run(
        "app.main:app",
        reload=True,
        host="127.0.0.1",
        port=8000,
    )


if __name__ == "__main__":
    main()
