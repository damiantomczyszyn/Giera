import asyncio
import io
import json
import random
import re
import sys
from pathlib import Path

import pygame

pygame.mixer.pre_init(44100, -16, 2, 1024)
pygame.init()

BASE = Path(__file__).resolve().parent
IMG_DIR = BASE / "assets" / "images"
SND_DIR = BASE / "assets" / "sounds"
SCORES_FILE = BASE / "scores.json"

WIDTH, HEIGHT = 900, 650
BG_COLOR = (32, 44, 36)
GREEN = (138, 226, 52)
RED = (164, 0, 0)

GAME_TIME = 9
CLICK_SCORE = 10
HIT_STEP = 100
FPS = 60

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Kapitan Dupa")
icon = pygame.image.load(str(IMG_DIR / "active.svg"))
pygame.display.set_icon(icon)
clock = pygame.time.Clock()

font_box_label = pygame.font.SysFont("arial", 20, bold=True)
font_box_value = pygame.font.SysFont("arial", 28, bold=True)
font_label = pygame.font.SysFont("arial", 42, bold=True)
font_value = pygame.font.SysFont("arial", 60, bold=True)
font_exclaim = pygame.font.SysFont("arial", 160, bold=True)
font_input = pygame.font.SysFont("consolas", 70, bold=True)
font_board_title = pygame.font.SysFont("arial", 34, bold=True)
font_board_row = pygame.font.SysFont("consolas", 26, bold=True)


def load_img(name, scale=1.0):
    img = pygame.image.load(str(IMG_DIR / name)).convert_alpha()
    if scale != 1.0:
        w = int(img.get_width() * scale)
        h = int(img.get_height() * scale)
        img = pygame.transform.smoothscale(img, (w, h))
    return img


img_start = load_img("start.svg")
img_restart = load_img("restart.svg")
img_active = load_img("active.svg", 2.2)
img_deactive = load_img("deactive.svg", 2.2)
img_gameover = load_img("gameover.svg", 1.3)


def render_hit_bar(red_count):
    raw = (IMG_DIR / "hit.svg").read_text(encoding="utf-8")
    for i in range(1, 10):
        if i <= red_count:
            raw = re.sub(
                r'(id="hit' + str(i) + r'"[\s\S]*?fill=")#8ae234',
                r"\1#a40000",
                raw,
                count=1,
            )
    data = raw.encode("utf-8")
    surf = pygame.image.load(io.BytesIO(data), "hit.svg").convert_alpha()
    return pygame.transform.smoothscale(surf, (280, 35))


hit_bars = [render_hit_bar(i) for i in range(10)]


def load_sound(name):
    return pygame.mixer.Sound(str(SND_DIR / f"{name}.ogg"))


SOUND_NAMES = [
    "truTuTu", "jakBabe", "noCoJest", "dlaczego", "gameOver",
    "zCalychSil", "wpiszLogin", "nicNieCzuje", "kapitanDupa",
    "miernyWynik", "sprobujJeszczeRaz", "rundaPierwsza", "najwyzszyWynik",
]
S = {name: load_sound(name) for name in SOUND_NAMES}

CH_UI = pygame.mixer.Channel(0)
CH_LOOP = pygame.mixer.Channel(1)
EVENT_UI_END = pygame.USEREVENT + 1
EVENT_LOOP_END = pygame.USEREVENT + 2
CH_UI.set_endevent(EVENT_UI_END)
CH_LOOP.set_endevent(EVENT_LOOP_END)


def load_scores():
    if SCORES_FILE.exists():
        try:
            return json.loads(SCORES_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def save_scores(scores):
    SCORES_FILE.write_text(json.dumps(scores, ensure_ascii=False), encoding="utf-8")


def top_score():
    s = load_scores()
    return max((x["value"] for x in s), default=0)


ST_START = "start"
ST_INTRO = "intro"
ST_PLAY = "play"
ST_OVER = "over"
ST_LOW_MIERNY = "low_mierny"
ST_LOW_KAPITAN = "low_kapitan"
ST_LOW_SPROBUJ = "low_sprobuj"
ST_HIGH_SHOW = "high_show"
ST_HIGH_LOGIN = "high_login"
ST_BOARD_KAP = "board_kap"
ST_BOARD_SPROBUJ = "board_sprobuj"


class Blink:
    def __init__(self):
        self.start = 0
        self.cycle = 0
        self.count = 0

    def begin(self, duration_s, count):
        self.start = pygame.time.get_ticks()
        self.cycle = int(duration_s * 1000)
        self.count = count

    def alpha(self):
        if self.count == 0 or self.cycle == 0:
            return 255
        elapsed = pygame.time.get_ticks() - self.start
        total = self.cycle * self.count
        if elapsed >= total:
            return 255
        pos = (elapsed % self.cycle) / self.cycle
        return int(255 * (1 - pos))


class Game:
    def __init__(self):
        self.state = ST_START
        self.score = 0
        self.time_left = GAME_TIME
        self.high_score = top_score()
        self.is_pressed = False
        self.name_input = ""
        self.blink_start = Blink()
        self.blink_go = Blink()
        self.blink_exclaim = Blink()
        self.blink_value = Blink()
        self._last_loop = "tru"
        self.scoreboard_cache = []

    def reset(self):
        self.score = 0
        self.time_left = GAME_TIME
        self.is_pressed = False
        self.name_input = ""
        self.high_score = top_score()

    def begin_intro(self):
        self.state = ST_INTRO
        CH_UI.play(S["rundaPierwsza"])
        self.blink_start.begin(0.8, 10)

    def activate_start_or_restart(self):
        if self.state in (ST_START, ST_LOW_SPROBUJ, ST_BOARD_SPROBUJ):
            self.reset()
            self.begin_intro()

    def handle_press(self):
        if self.state == ST_PLAY and not self.is_pressed:
            self.is_pressed = True

    def handle_release(self):
        if self.state == ST_PLAY and self.is_pressed:
            self.is_pressed = False
            self.score += CLICK_SCORE

    def update(self, dt):
        if self.state == ST_PLAY:
            self.time_left -= dt
            if self.time_left <= 0:
                self.time_left = 0
                self._end_game()

    def _end_game(self):
        self.state = ST_OVER
        CH_LOOP.stop()
        CH_UI.play(S["gameOver"])
        self.blink_go.begin(0.3, 10)

    def on_ui_end(self):
        if self.state == ST_INTRO:
            self.state = ST_PLAY
            self._last_loop = "tru"
            CH_LOOP.play(S["truTuTu"])
        elif self.state == ST_OVER:
            if self.score < self.high_score:
                self.state = ST_LOW_MIERNY
                CH_UI.play(S["miernyWynik"])
            else:
                self.state = ST_HIGH_SHOW
                self.blink_exclaim.begin(0.6, 5)
                self.blink_value.begin(0.55, 5)
                CH_UI.play(S["najwyzszyWynik"])
        elif self.state == ST_LOW_MIERNY:
            self.state = ST_LOW_KAPITAN
            CH_UI.play(S["kapitanDupa"])
        elif self.state == ST_LOW_KAPITAN:
            self.state = ST_LOW_SPROBUJ
            CH_UI.play(S["sprobujJeszczeRaz"])
        elif self.state == ST_HIGH_SHOW:
            self.state = ST_HIGH_LOGIN
            CH_UI.play(S["wpiszLogin"])
        elif self.state == ST_BOARD_KAP:
            self.state = ST_BOARD_SPROBUJ
            CH_UI.play(S["sprobujJeszczeRaz"])

    def on_loop_end(self):
        if self.state != ST_PLAY:
            return
        if self._last_loop == "tru":
            r = random.randint(0, 5)
            if r == 0:
                CH_LOOP.play(S["nicNieCzuje"])
                self._last_loop = "tau"
            elif r == 1:
                CH_LOOP.play(S["dlaczego"])
                self._last_loop = "tau"
            elif r == 2:
                CH_LOOP.play(S["jakBabe"])
                self._last_loop = "tau"
            elif r == 3:
                CH_LOOP.play(S["noCoJest"])
                self._last_loop = "tau"
            elif r == 4:
                CH_LOOP.play(S["zCalychSil"])
                self._last_loop = "tau"
            else:
                CH_LOOP.play(S["truTuTu"])
                self._last_loop = "tru"
        else:
            CH_LOOP.play(S["truTuTu"])
            self._last_loop = "tru"

    def submit_name(self):
        name = self.name_input.strip().upper()[:5]
        if not name:
            return
        scores = load_scores()
        scores.append({"name": name, "value": self.score})
        save_scores(scores)
        self.scoreboard_cache = sorted(scores, key=lambda s: -s["value"])[:10]
        self.state = ST_BOARD_KAP
        CH_UI.play(S["kapitanDupa"])


def draw_metric_box(surface, rect, label, value):
    x, y, w, h = rect
    pygame.draw.rect(surface, GREEN, rect, 3, border_radius=10)
    lab = font_box_label.render(label, True, GREEN)
    val = font_box_value.render(value, True, GREEN)
    surface.blit(lab, (x + (w - lab.get_width()) // 2, y + 6))
    surface.blit(val, (x + (w - val.get_width()) // 2, y + h - val.get_height() - 6))


def draw_hit_box(surface, rect, red_count):
    x, y, w, h = rect
    pygame.draw.rect(surface, GREEN, rect, 3, border_radius=10)
    lab = font_box_label.render("HIT", True, GREEN)
    surface.blit(lab, (x + 12, y + (h - lab.get_height()) // 2))
    bar = hit_bars[min(9, red_count)]
    bx = x + 55
    by = y + (h - bar.get_height()) // 2
    surface.blit(bar, (bx, by))


def draw_hud(game):
    y = HEIGHT - 90
    box_w = 130
    hit_w = 340
    gap = 20
    total = box_w + gap + hit_w + gap + box_w
    x0 = (WIDTH - total) // 2
    draw_metric_box(screen, (x0, y, box_w, 70), "SCORE", str(game.score))
    draw_hit_box(screen, (x0 + box_w + gap, y, hit_w, 70), game.score // HIT_STEP)
    draw_metric_box(
        screen,
        (x0 + box_w + gap + hit_w + gap, y, box_w, 70),
        "SHOT",
        f"{max(0, int(game.time_left))}SEK",
    )


def blit_center(surface, img, center):
    rect = img.get_rect(center=center)
    surface.blit(img, rect)


def draw(game):
    screen.fill(BG_COLOR)
    center = (WIDTH // 2, HEIGHT // 2 - 40)

    if game.state == ST_START:
        blit_center(screen, img_start, (WIDTH // 2, HEIGHT // 2))
    elif game.state == ST_INTRO:
        img = img_start.copy()
        img.set_alpha(game.blink_start.alpha())
        blit_center(screen, img, (WIDTH // 2, HEIGHT // 2))
    elif game.state == ST_PLAY:
        player = img_active if game.is_pressed else img_deactive
        blit_center(screen, player, center)
        draw_hud(game)
    elif game.state == ST_OVER:
        img = img_gameover.copy()
        img.set_alpha(game.blink_go.alpha())
        blit_center(screen, img, (WIDTH // 2, HEIGHT // 2 - 30))
        draw_hud(game)
    elif game.state in (ST_LOW_MIERNY, ST_LOW_KAPITAN):
        draw_hud(game)
    elif game.state == ST_LOW_SPROBUJ:
        blit_center(screen, img_restart, (WIDTH // 2, HEIGHT // 2))
    elif game.state == ST_HIGH_SHOW:
        excl = font_exclaim.render("!", True, GREEN)
        excl.set_alpha(game.blink_exclaim.alpha())
        blit_center(screen, excl, (WIDTH // 2, HEIGHT // 2 - 100))
        lab = font_label.render("SCORE:", True, GREEN)
        blit_center(screen, lab, (WIDTH // 2, HEIGHT // 2 + 40))
        val = font_value.render(str(game.score), True, GREEN)
        val.set_alpha(game.blink_value.alpha())
        blit_center(screen, val, (WIDTH // 2, HEIGHT // 2 + 110))
    elif game.state == ST_HIGH_LOGIN:
        lab = font_label.render("LOGIN:", True, GREEN)
        blit_center(screen, lab, (WIDTH // 2, HEIGHT // 2 - 30))
        text = game.name_input.upper()
        cursor_on = (pygame.time.get_ticks() // 400) % 2 == 0
        display = text + ("_" if cursor_on and len(text) < 5 else "")
        if not display:
            display = "*" * 5
            surf = font_input.render(display, True, GREEN)
            surf.set_alpha(120)
        else:
            surf = font_input.render(display, True, GREEN)
        blit_center(screen, surf, (WIDTH // 2, HEIGHT // 2 + 50))
    elif game.state in (ST_BOARD_KAP, ST_BOARD_SPROBUJ):
        title = font_board_title.render("SCOREBOARD", True, GREEN)
        blit_center(screen, title, (WIDTH // 2, 110))
        y = 170
        for i, s in enumerate(game.scoreboard_cache):
            line = f"{i + 1:2d}. {s['name']:<5s}  {s['value']:>5d}"
            row = font_board_row.render(line, True, GREEN)
            blit_center(screen, row, (WIDTH // 2, y))
            y += 36
        if game.state == ST_BOARD_SPROBUJ:
            blit_center(screen, img_restart, (WIDTH // 2, HEIGHT - 110))


def handle_event(event, game):
    if event.type == pygame.QUIT:
        return False
    if event.type == EVENT_UI_END:
        game.on_ui_end()
    elif event.type == EVENT_LOOP_END:
        game.on_loop_end()
    elif event.type == pygame.KEYDOWN:
        if event.key == pygame.K_ESCAPE:
            return False
        if game.state == ST_HIGH_LOGIN:
            if event.key == pygame.K_RETURN:
                game.submit_name()
            elif event.key == pygame.K_BACKSPACE:
                game.name_input = game.name_input[:-1]
            elif event.unicode and event.unicode.isprintable() and len(game.name_input) < 5:
                game.name_input += event.unicode
        else:
            if event.key == pygame.K_SPACE:
                if game.state in (ST_START, ST_LOW_SPROBUJ, ST_BOARD_SPROBUJ):
                    game.activate_start_or_restart()
                elif game.state == ST_PLAY:
                    game.handle_press()
    elif event.type == pygame.KEYUP:
        if event.key == pygame.K_SPACE and game.state == ST_PLAY:
            game.handle_release()
    elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
        if game.state in (ST_START, ST_LOW_SPROBUJ, ST_BOARD_SPROBUJ):
            game.activate_start_or_restart()
        elif game.state == ST_PLAY:
            game.handle_press()
    elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
        if game.state == ST_PLAY:
            game.handle_release()
    return True


async def main():
    game = Game()
    running = True
    while running:
        dt = clock.tick(FPS) / 1000.0
        for event in pygame.event.get():
            if not handle_event(event, game):
                running = False
                break
        game.update(dt)
        draw(game)
        pygame.display.flip()
        await asyncio.sleep(0)
    pygame.quit()


if __name__ == "__main__":
    asyncio.run(main())
    sys.exit(0)
