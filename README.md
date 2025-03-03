terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

##########################
# IAM Role & Policies
##########################

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "polly_synthesize_policy" {
  name        = "lambda_polly_synthesize_policy"
  description = "Allow only polly:SynthesizeSpeech action"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "polly:SynthesizeSpeech",
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "polly_access" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.polly_synthesize_policy.arn
}

##########################
# Lambda Function
##########################

resource "aws_lambda_function" "my_lambda" {
  function_name = "polly_synthesizer"
  runtime       = "python3.8"
  handler       = "index.lambda_handler"
  role          = aws_iam_role.lambda_exec.arn

  # Inline Lambda code (uses the filename "index.py")
  zip_file = <<EOF
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
EOF
}

##########################
# Cognito User Pool & Client
##########################

resource "aws_cognito_user_pool" "user_pool" {
  name = "api_user_pool"
}

resource "aws_cognito_user_pool_client" "user_pool_client" {
  name         = "api_user_pool_client"
  user_pool_id = aws_cognito_user_pool.user_pool.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH"
  ]
}

##########################
# API Gateway HTTP API
##########################

resource "aws_apigatewayv2_api" "http_api" {
  name          = "http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = ["*"]
    allow_methods  = ["POST"]
    allow_headers  = ["authorization", "content-type"]
    expose_headers = ["content-length"]
  }
}

##########################
# API Integration & Route
##########################

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.my_lambda.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "cognito_auth" {
  api_id           = aws_apigatewayv2_api.http_api.id
  name             = "cognito-authorizer"
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.user_pool_client.id]
    issuer   = "https://cognito-idp.us-east-1.amazonaws.com/${aws_cognito_user_pool.user_pool.id}"
  }
}

resource "aws_apigatewayv2_route" "post_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

##########################
# Lambda Permission for API Gateway
##########################

resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.my_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
