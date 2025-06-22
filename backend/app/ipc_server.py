#!/usr/bin/env python3
"""
IPC Server for handling communication with Electron frontend
Provides JSON-based message protocol over stdin/stdout
"""

import sys
import json
import asyncio
import signal
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/tmp/pdf-extractor-ipc.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger(__name__)


class IPCServer:
    """Handles IPC communication with Electron frontend"""
    
    def __init__(self):
        self.running = False
        self.message_handlers = {}
        self.setup_handlers()
        
    def setup_handlers(self):
        """Register message handlers"""
        self.message_handlers = {
            'ping': self.handle_ping,
            'shutdown': self.handle_shutdown,
            'extraction.process': self.handle_extraction,
            'export.excel': self.handle_export,
            'file.read': self.handle_file_read,
            'file.validate': self.handle_file_validate,
        }
    
    async def handle_ping(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle ping messages for connection check"""
        return {
            'id': message.get('id'),
            'type': 'pong',
            'timestamp': int(datetime.now().timestamp() * 1000)
        }
    
    async def handle_shutdown(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle shutdown request"""
        self.running = False
        return {
            'id': message.get('id'),
            'type': 'shutdown.response',
            'status': 'success',
            'payload': {'message': 'Shutting down'},
            'timestamp': int(datetime.now().timestamp() * 1000)
        }
    
    async def handle_extraction(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle PDF extraction request"""
        try:
            payload = message.get('payload', {})
            file_path = payload.get('file')
            mode = payload.get('mode', 'automatic')
            
            # TODO: Integrate with actual PDF processor
            # For now, return mock data
            result = {
                'sessionId': f'session-{int(datetime.now().timestamp())}',
                'fields': [
                    {
                        'name': 'check_number',
                        'value': '12345',
                        'confidence': 0.95,
                        'bbox': [100, 100, 200, 120]
                    },
                    {
                        'name': 'date',
                        'value': '2024-01-15',
                        'confidence': 0.98,
                        'bbox': [300, 100, 400, 120]
                    }
                ],
                'mode': mode
            }
            
            # Send progress updates
            await self.send_progress('extraction.progress', {
                'sessionId': result['sessionId'],
                'progress': 50,
                'currentField': 'check_number',
                'message': 'Extracting check number...'
            })
            
            return {
                'id': message.get('id'),
                'type': 'extraction.process.response',
                'status': 'success',
                'payload': result,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            
        except Exception as e:
            logger.error(f"Extraction error: {str(e)}\n{traceback.format_exc()}")
            return {
                'id': message.get('id'),
                'type': 'extraction.process.response',
                'status': 'error',
                'error': str(e),
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
    
    async def handle_export(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Excel export request"""
        try:
            payload = message.get('payload', {})
            session_id = payload.get('sessionId')
            output_path = payload.get('outputPath')
            
            # TODO: Integrate with actual Excel exporter
            result = {
                'filePath': output_path or '/tmp/export.xlsx',
                'rowCount': 10,
                'fileSize': 25600
            }
            
            return {
                'id': message.get('id'),
                'type': 'export.excel.response',
                'status': 'success',
                'payload': result,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            
        except Exception as e:
            logger.error(f"Export error: {str(e)}\n{traceback.format_exc()}")
            return {
                'id': message.get('id'),
                'type': 'export.excel.response',
                'status': 'error',
                'error': str(e),
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
    
    async def handle_file_read(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle file read request"""
        try:
            payload = message.get('payload', {})
            file_path = payload.get('path')
            
            # TODO: Integrate with secure file handler
            # For now, return mock data
            result = {
                'path': file_path,
                'size': 1024000,
                'mimeType': 'application/pdf',
                'exists': True
            }
            
            return {
                'id': message.get('id'),
                'type': 'file.read.response',
                'status': 'success',
                'payload': result,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            
        except Exception as e:
            logger.error(f"File read error: {str(e)}\n{traceback.format_exc()}")
            return {
                'id': message.get('id'),
                'type': 'file.read.response',
                'status': 'error',
                'error': str(e),
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
    
    async def handle_file_validate(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Handle file validation request"""
        try:
            payload = message.get('payload', {})
            file_path = payload.get('path')
            
            # TODO: Integrate with security validators
            result = {
                'valid': True,
                'mimeType': 'application/pdf',
                'size': 1024000,
                'issues': []
            }
            
            return {
                'id': message.get('id'),
                'type': 'file.validate.response',
                'status': 'success',
                'payload': result,
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            
        except Exception as e:
            logger.error(f"File validation error: {str(e)}\n{traceback.format_exc()}")
            return {
                'id': message.get('id'),
                'type': 'file.validate.response',
                'status': 'error',
                'error': str(e),
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
    
    async def send_progress(self, event_type: str, payload: Dict[str, Any]):
        """Send progress event to frontend"""
        message = {
            'type': event_type,
            'timestamp': int(datetime.now().timestamp() * 1000),
            'payload': payload
        }
        self.send_message(message)
    
    def send_message(self, message: Dict[str, Any]):
        """Send message to frontend via stdout"""
        try:
            json_str = json.dumps(message)
            print(json_str, flush=True)
        except Exception as e:
            logger.error(f"Failed to send message: {str(e)}")
    
    async def process_message(self, message: Dict[str, Any]):
        """Process incoming message"""
        msg_type = message.get('type')
        
        if msg_type in self.message_handlers:
            handler = self.message_handlers[msg_type]
            response = await handler(message)
            if response:
                self.send_message(response)
        else:
            error_response = {
                'id': message.get('id'),
                'type': f'{msg_type}.response',
                'status': 'error',
                'error': f'Unknown message type: {msg_type}',
                'timestamp': int(datetime.now().timestamp() * 1000)
            }
            self.send_message(error_response)
    
    async def read_stdin(self):
        """Read messages from stdin"""
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)
        
        while self.running:
            try:
                # Read line from stdin
                line = await reader.readline()
                if not line:
                    break
                    
                # Decode and parse JSON
                message_str = line.decode('utf-8').strip()
                if message_str:
                    try:
                        message = json.loads(message_str)
                        await self.process_message(message)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON: {message_str}\nError: {str(e)}")
                        
            except Exception as e:
                logger.error(f"Error reading stdin: {str(e)}\n{traceback.format_exc()}")
                await asyncio.sleep(0.1)  # Prevent tight loop on error
    
    async def run(self):
        """Main server loop"""
        self.running = True
        logger.info("IPC Server started")
        
        # Set up signal handlers
        def signal_handler(sig, frame):
            logger.info(f"Received signal {sig}")
            self.running = False
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            await self.read_stdin()
        except Exception as e:
            logger.error(f"Server error: {str(e)}\n{traceback.format_exc()}")
        finally:
            logger.info("IPC Server stopped")


async def main():
    """Main entry point"""
    server = IPCServer()
    await server.run()


if __name__ == '__main__':
    # Run the server
    asyncio.run(main())