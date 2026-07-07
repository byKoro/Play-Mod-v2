@echo off
REM ============================================================
REM Play Mod - sincroniza as pastas do projeto para as pastas
REM de development packs do Minecraft Bedrock.
REM
REM Usa /MIR (espelhar): o destino fica IDENTICO a origem, ou
REM seja, arquivos que existirem no destino mas nao existirem
REM mais na origem SAO APAGADOS. E o comportamento certo pra
REM "replicar tudo", mas por isso so aponte esse script pra
REM pastas de destino dedicadas ao Play Mod (como ja e o caso
REM abaixo) - nunca para uma pasta com outros arquivos que
REM voce queira manter.
REM ============================================================

set ORIGEM_BP=C:\Users\Usuario\Desktop\Play Mod\Play Mod v2 - BP
set DESTINO_BP=C:\Users\Usuario\AppData\Roaming\Minecraft Bedrock\users\shared\games\com.mojang\development_behavior_packs\Play Mod - BP

set ORIGEM_RP=C:\Users\Usuario\Desktop\Play Mod\Play Mod v2 - RP
set DESTINO_RP=C:\Users\Usuario\AppData\Roaming\Minecraft Bedrock\users\shared\games\com.mojang\development_resource_packs\Play Mod - RP

echo Sincronizando Behavior Pack...
robocopy "%ORIGEM_BP%" "%DESTINO_BP%" /MIR /NFL /NDL /NJH /NJS

echo.
echo Sincronizando Resource Pack...
robocopy "%ORIGEM_RP%" "%DESTINO_RP%" /MIR /NFL /NDL /NJH /NJS

echo.
echo Concluido! Pressione qualquer tecla para fechar.
pause >nul
