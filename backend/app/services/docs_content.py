"""Initial editorial content. Runtime counts and availability come from the app."""

PITCH = (
    ("problem", "Problem", "A farmer has to piece together guidance on crop health, weather, farm costs, and selling. Information is often separated from the decision it needs to support."),
    ("solution", "Solution", "Amader Krishi AI puts those decisions into a Bangla-first workspace, from soil and crop planning through care, harvest, and an approved produce listing."),
    ("why-now", "Why now", "A browser-based workflow can bring weather, a photo, and farm records together at the point a farmer needs to decide. Our first goal is to learn where that combination saves practical effort."),
    ("product-demo", "Product demo", "Choose a crop using soil and climate inputs. Try rice or tomato leaf analysis. Then follow the listing review and buying request workflow in Krishi Market."),
    ("market", "Market opportunity", "Our initial audience is smallholder growers and local produce buyers in Bangladesh. Extension workers and cooperatives are potential distribution partners. We plan to validate the size of the reachable market through local pilots."),
    ("business-model", "Business model", "Pilot hypothesis. Keep core farmer tools accessible and test paid workflows with cooperatives or organisations that coordinate farm services and produce sourcing."),
    ("traction", "Traction", "Team Mind Forge built a working research prototype and spoke with farmers before designing its workflows. Live product activity is shown when the team publishes aggregate metrics. Accounts and product events do not represent paid customers or field outcomes."),
    ("competition", "Competition", "Farmers already use extension advice, weather services, and local trading channels. We compare our approach with these alternatives during pilots, especially for ease of use and quality of decisions."),
    ("advantage", "Unique advantage", "One workflow connects Bangla guidance and specialist model outputs to farm records and a reviewed marketplace. Prediction history makes individual model runs reviewable."),
    ("go-to-market", "Go-to-market", "Start with a small facilitated pilot. Take participants through crop planning, plant health and a listing review, then measure repeat use and where the workflow breaks down."),
    ("team", "Team", "Team Mind Forge"),
    ("vision", "Vision", "Give growers a practical record of their season and better information at each step, while validating recommendations on real farms."),
)

TECHNICAL = (
    ("overview", "Product overview", "A farmer can record a plot and its soil tests, compare crops, plan work around weather, review crop health, and track the harvest. Buyers can browse approved produce listings. Admins review listings and control this documentation."),
    ("features", "Feature matrix", "Live entries are resolved from registered application endpoints. Registration does not measure availability of each upstream provider. Roadmap entries describe intended work."),
    ("architecture", "System architecture", "The React workspace calls a FastAPI service. Domain services run inference and manage records through SQLAlchemy. Vercel serves the frontend and Render hosts the backend."),
    ("data-flow", "Data flow", "Farm inputs or a leaf image are validated before processing. The result is returned to the user and prediction runs can be reviewed in history. User feedback and recorded outcomes inform future evaluation."),
    ("stack", "Technology stack", "React, TypeScript and Vite on the frontend. FastAPI, Pydantic and SQLAlchemy on the backend, with SQLite for local use and PostgreSQL supported for persistent deployments. Models run with scikit-learn or Keras."),
    ("api", "API reference", "The catalog resolves paths and methods from the running API. Farmer operations use the signed-in user's token and ownership checks. The editorial API uses the existing admin session. Passwords, tokens and provider credentials are confidential."),
    ("data", "Data sources and privacy", "Data comes from user-entered farm records, registered research artifacts and weather-provider APIs. Forecasts use Open-Meteo with the app's configured fallback where available. Product activity here is aggregated. Private farm coordinates, chat messages, buyer contact information and raw predictions are excluded from the public snapshot."),
    ("ai", "AI, retrieval and personalization", "The model registry contains task-specific models for crop suitability, regional rice yield, leaf analysis, flooding susceptibility and prices. The advisor can route to specialist tools and a configured chat provider. Prediction history and benchmark notes distinguish research outputs from field outcomes. GraphRAG and personalised model retraining are future options, subject to evaluation."),
    ("roadmap", "Roadmap", "Near term. Field-test the existing workflows and improve local data coverage. Mid term. Validate the IoT-assisted soil workflow and strengthen evaluation. Long term. Test farmer-approved feedback and broader market integrations."),
    ("performance", "Performance and scalability", "The docs bundle loads only when its route opens. The public content is a published snapshot and the live panel uses aggregate queries. Existing inference loads model artifacts on demand. Establish load and latency baselines in a pilot before committing to an SLA."),
    ("security", "Security and publishing", "Farmer data uses authenticated ownership checks. A server-side window gates every public documentation response. Editorial writes reuse the staff session and enforce optimistic version checks. Team emails are editorial contact fields and can be hidden from the public page."),
    ("analytics", "Analytics", "Registered accounts, prediction events and approved listings can be shared as aggregate counts. Future pilot KPIs include task completion and repeat use. Current activity counts measure product usage, with demo and synthetic records excluded where the application identifies them."),
    ("contributors", "Team and contributors", "Roles and team contact details are maintained in the team directory above."),
    ("changelog", "Changelog", "Documentation releases record when a published version changes. The application version is reported by the active backend."),
)

FEATURES = (
    ("Farm workspace", "/farms"),
    ("Crop and soil models", "/predict/{model_id}"),
    ("Prediction history", "/history/"),
    ("Bangla AI advisor", "/chat/sessions/{session_id}/messages"),
    ("District weather", "/weather/farms/{farm_id}/forecast"),
    ("Farm calendar", "/calendar/tasks"),
    ("Produce marketplace", "/produce-market/listings"),
    ("Buyer purchase requests", "/produce-market/listings/{key}/orders"),
    ("Budget calculator", "/farm-hub/calculate"),
)

ENDPOINTS = {
    "/health": ("Service and model inventory summary", "Public"),
    "/models/": ("Registered model metadata", "Public"),
    "/predict/{model_id}": ("Run image or tabular model inference", "Farmer token"),
    "/history/": ("List the signed-in farmer's predictions", "Farmer token"),
    "/chat/sessions/{session_id}/messages": ("Send an advisory message", "Farmer token"),
    "/farms": ("List or create the signed-in user's farms", "Farmer token"),
    "/calendar/tasks": ("Manage the signed-in user's calendar tasks", "Farmer token"),
    "/weather/farms/{farm_id}/forecast": ("Forecast for an owned farm", "Farmer token"),
    "/produce-market/listings": ("Browse approved produce listings", "Public"),
    "/produce-market/listings/{key}/orders": ("Submit a purchase request", "Farmer token"),
    "/farm-hub/calculate": ("Calculate farm budget estimates", "Farmer token"),
    "/project-docs/public": ("Read the published documentation snapshot", "Public during availability"),
}


def initial_document():
    def section(category, key, title, content):
        return {
            "id": key,
            "group": category,
            "title": title,
            "blocks": [{"kind": "paragraph", "text": content}],
        }

    return {
        "title": "আমাদের কৃষি AI",
        "tagline": "A Bangla-first workspace for the decisions that shape a growing season.",
        "team_name": "Team Mind Forge",
        "sections": [section("pitch", *item) for item in PITCH]
        + [section("technical", *item) for item in TECHNICAL],
        "team": [],
        "architecture": ["React workspace", "FastAPI", "Domain services", "SQLAlchemy database"],
        "data_flow": ["Farm or image input", "Validation", "AI inference", "Result", "Feedback"],
        "roadmap": [
            {"name": "IoT-assisted soil testing", "status": "upcoming"},
            {"name": "Field evaluation and farmer feedback", "status": "planned"},
        ],
        "show_metrics": False,
    }
