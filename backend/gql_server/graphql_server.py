# gql_server/graphql_server.py

import os
from datetime import datetime

from ariadne import (
    make_executable_schema,
    load_schema_from_path,
    snake_case_fallback_resolvers,
    ScalarType,
    graphql_sync,
)
from flask import request, jsonify

from .auth_middleware import build_graphql_context

# 🔥 IMPORT user_object HERE
from .resolvers import query, mutation, auth_payload, user_object


# --- GraphQL Playground HTML ---

PLAYGROUND_HTML = """
<!DOCTYPE html>
<html>

<head>
  <meta charset=utf-8/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GraphQL Playground</title>
  <link rel="stylesheet"
    href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
  <link rel="shortcut icon"
    href="//cdn.jsdelivr.net/npm/graphql-playground-react/build/favicon.png" />
  <script src="//cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
</head>

<body>
  <div id="root"></div>
  <script>
    window.addEventListener('load', function (event) {
      GraphQLPlayground.init(document.getElementById('root'), {
        endpoint: '/graphql'
      })
    })
  </script>
</body>

</html>
"""


# --- DateTime scalar ---

datetime_scalar = ScalarType("DateTime")


@datetime_scalar.serializer
def serialize_datetime(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@datetime_scalar.value_parser
def parse_datetime_value(value):
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    return value


def create_schema():
    schema_path = os.path.join(os.path.dirname(__file__), "schema.graphql")
    type_defs = load_schema_from_path(schema_path)

    schema = make_executable_schema(
        type_defs,
        [
            query,
            mutation,
            auth_payload,
            user_object,  # 🔥 THIS WAS MISSING
            datetime_scalar,
            snake_case_fallback_resolvers,
        ],
    )

    return schema


def register_graphql_route(app):
    schema = create_schema()

    @app.route("/graphql", methods=["GET", "POST"])
    def graphql_server():

        if request.method == "GET":
            return PLAYGROUND_HTML, 200, {"Content-Type": "text/html"}

        data = request.get_json()
        if not data:
            return jsonify({"error": "No input provided"}), 400

        success, result = graphql_sync(
            schema,
            data,
            context_value=build_graphql_context(request),
            debug=app.debug,
        )

        status_code = 200 if success else 400
        return jsonify(result), status_code