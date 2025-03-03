import json
import boto3
import base64

def lambda_handler(event, context):
    try:
        data = json.loads(event['body'])
    except Exception as e:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON input."})
        }
    
    text = data.get('text', '')
    if not text:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "No text provided"})
        }
        
    voice = data.get('voice', 'Joanna')
    engine = data.get('engine', 'standard')
    
    polly = boto3.client('polly')
    
    try:
        response = polly.synthesize_speech(
            Text=text,
            OutputFormat='mp3',
            VoiceId=voice,
            Engine=engine
        )
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
    
    audio_stream = response.get('AudioStream')
    if audio_stream:
        audio_bytes = audio_stream.read()
        encoded_audio = base64.b64encode(audio_bytes).decode('utf-8')
        return {
            "statusCode": 200,
            "body": encoded_audio,
            "isBase64Encoded": True
        }
    else:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Audio stream not available from Polly"})
        }
