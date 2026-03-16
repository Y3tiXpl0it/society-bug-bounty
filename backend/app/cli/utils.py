import typer

def format_cli_error(detail) -> str:
    """
    Extracts a human-readable message from an exception's detail field.
    After the error-code refactoring, detail is a dict like:
        {'code': ErrorCode.SOME_CODE, 'message': '...', 'params': {...}}
    This helper returns the message prefixed by the ErrorCode.
    """
    if isinstance(detail, dict):
        code = detail.get("code")
        message = detail.get("message")
        
        if code and message:
            return f"[{code}] {message}"
        elif message:
            return str(message)
            
    return str(detail)
