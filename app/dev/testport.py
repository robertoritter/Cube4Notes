# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Porta livre para os testes. Portas fixas na faixa 43xxx podem estar em uso por outro programa (no Linux essa faixa
# também serve para conexões de saída), então cada teste escolhe uma porta livre entre 20000 e 29999, abaixo das
# faixas de portas temporárias do Linux, do Windows e do macOS. A porta anterior também fica livre (o Cube4Notes usa
# a porta - 1 para o HTTP que redireciona).
import os, random, socket


def _free(port):
    for family, addr in ((socket.AF_INET, "0.0.0.0"), (socket.AF_INET6, "::")):
        try:
            s = socket.socket(family, socket.SOCK_STREAM)
        except OSError:
            continue
        try:
            s.bind((addr, port))
        except OSError:
            return False
        finally:
            s.close()
    return True


def free_port(env="C4N_TEST_PORT"):
    if os.environ.get(env):
        return int(os.environ[env])
    rnd = random.Random()
    for _ in range(200):
        port = rnd.randrange(20001, 30000)
        if _free(port) and _free(port - 1):
            return port
    raise RuntimeError("nenhuma porta livre entre 20000 e 29999")
