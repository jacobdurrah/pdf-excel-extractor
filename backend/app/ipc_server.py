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

from .message_handler import ExtractorMessageHandler, logging_middleware, rate_limit_middleware
from .protocols import BaseMessage

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
        self.message_handler = ExtractorMessageHandler()
        self.setup_middleware()
        
    def setup_middleware(self):
        """Setup message processing middleware"""
        # Add logging middleware
        self.message_handler.use_middleware(logging_middleware)
        
        # Add rate limiting middleware (100 requests per minute)
        self.message_handler.use_middleware(rate_limit_middleware(100, 60))
    
    def set_pdf_processor(self, processor):
        """Set the PDF processor for extraction"""
        self.message_handler.pdf_processor = processor
    
    def set_excel_exporter(self, exporter):
        """Set the Excel exporter"""
        self.message_handler.excel_exporter = exporter
    
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
        try:
            # Use the message handler to process the message
            response = await self.message_handler.process_message(message)
            
            if response:
                self.send_message(response)
                
        except Exception as e:
            logger.error(f"Failed to process message: {str(e)}\n{traceback.format_exc()}")
            error_response = {
                'id': message.get('id'),
                'type': f"{message.get('type', 'unknown')}.response",
                'status': 'error',
                'error': {
                    'code': 'ERR_PROCESSING_FAILED',
                    'message': str(e),
                    'timestamp': int(datetime.now().timestamp() * 1000)
                },
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
        logger.info(f"Message handler stats: {self.message_handler.get_stats()}")
        
        # Set up signal handlers
        def signal_handler(sig, frame):
            logger.info(f"Received signal {sig}")
            self.running = False
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            await self.read_stdin()
        except KeyboardInterrupt:
            logger.info("Shutdown requested")
        except Exception as e:
            logger.error(f"Server error: {str(e)}\n{traceback.format_exc()}")
        finally:
            logger.info(f"Final stats: {self.message_handler.get_stats()}")
            logger.info("IPC Server stopped")


async def main():
    """Main entry point"""
    server = IPCServer()
    await server.run()


if __name__ == '__main__':
    # Run the server
    asyncio.run(main())