# AgriSphere AI API routers

from . import health
from . import model_status
from . import auth
from . import predictions
from . import chat
from . import history
from . import calendar
from . import weather
from . import soil
from . import cultivation
from . import harvest

__all__ = ["health", "model_status", "auth", "predictions", "chat", "history", "calendar", "weather", "soil", "cultivation", "harvest"]
