from .aftersales import *
from .announcement import *
from .approval import *
from .attendance import *
from .auth import *
from .department import *
from .dingtalk import *
from .finance import *
from .gift import *
from .knowledge import *
from .misc import *
from .notification import *
from .role import *
from .schedule import *
from .ticket import *
from .warehouse import *

# Rebuild models with forward references
from .auth import UserInfo
UserInfo.model_rebuild()
