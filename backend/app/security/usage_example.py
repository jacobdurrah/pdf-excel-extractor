"""
Example usage of the security module for other agents.
This demonstrates how to integrate security features.
"""

from pathlib import Path
from typing import Dict, Any

# Import the security wrapper
from . import get_security, AuditAction


def example_secure_pdf_processing():
    """Example of processing a PDF with full security."""
    
    # Get the global security instance
    security = get_security()
    
    # Create a session for the user
    session_id = security.create_session(user_id="demo_user")
    
    try:
        # Example PDF path
        pdf_path = Path("/path/to/document.pdf")
        
        # Define your processing function
        def extract_data_from_pdf(secure_pdf_path: Path) -> Dict[str, Any]:
            """Your PDF processing logic here."""
            # This runs with:
            # - Network blocked
            # - Memory limited
            # - File validated
            # - Audit logging
            
            # Example extraction result
            return {
                'fields': {
                    'invoice_number': '12345',
                    'amount': '$1,234.56'
                },
                'tables': [],
                'metadata': {
                    'pages': 2,
                    'confidence': 0.95
                }
            }
        
        # Process with security
        result = security.process_with_security(
            session_id=session_id,
            file_path=pdf_path,
            process_func=extract_data_from_pdf,
            action="extract"  # Will be logged as audit action
        )
        
        # Check for sensitive data in results
        for field_name, field_value in result['fields'].items():
            sensitive_check = security.check_sensitive_data(field_value)
            if sensitive_check['has_sensitive_data']:
                print(f"Warning: Field '{field_name}' contains: {sensitive_check['detected_types']}")
                # Use masked version if needed
                result['fields'][field_name] = sensitive_check['masked_text']
        
        return result
        
    finally:
        # Always end the session
        security.end_session(session_id)


def example_input_validation():
    """Example of validating user inputs."""
    
    security = get_security()
    
    # Validate filename
    filename = "../../etc/passwd"  # Malicious attempt
    is_valid, sanitized = security.validate_input(filename, "filename")
    if not is_valid:
        print(f"Invalid filename: {sanitized}")
    
    # Validate path
    path = "/Users/john/documents/file.pdf"
    is_valid, error = security.validate_input(path, "path")
    if not is_valid:
        print(f"Invalid path: {error}")
    
    # Sanitize string input
    user_input = "Some text with \x00 null bytes"
    is_valid, sanitized = security.validate_input(user_input, "string")
    print(f"Sanitized: {sanitized}")
    
    # Validate JSON
    json_data = '{"name": "test", "value": 123}'
    is_valid, parsed = security.validate_input(json_data, "json")
    if is_valid:
        print(f"Valid JSON: {parsed}")


def example_memory_monitoring():
    """Example of monitoring memory usage."""
    
    security = get_security()
    
    # Get current status
    status = security.get_security_status()
    print(f"Memory usage: {status['memory_usage_mb']:.1f}MB ({status['memory_percent']:.1f}%)")
    
    # Use memory-limited context
    with security.memory_limited_operation(max_mb=100):
        # Your memory-intensive operation here
        data = ['x' * 1000000 for _ in range(50)]  # ~50MB
    # Memory automatically cleaned up after context


# Integration guide for other agents:
"""
1. Import security at the top of your module:
   from app.security import get_security

2. Create a session when handling a request:
   security = get_security()
   session_id = security.create_session(user_id)

3. Process files securely:
   result = security.process_with_security(
       session_id, file_path, your_process_function
   )

4. Always end sessions:
   security.end_session(session_id)

5. The security module automatically:
   - Blocks all network requests
   - Validates file types and sizes
   - Manages memory usage
   - Logs all operations
   - Cleans up temporary files
   - Detects sensitive data
"""