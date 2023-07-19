FROM ubuntu:20.04
SHELL ["/bin/bash", "-c"]

WORKDIR /home

# The following two lines work around a package that requires manual input when
# installing (tzdata package)
ENV TZ=Europe/Berlin
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Works around a package that requires manual input when installing (keyboard-configuration)
ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install sed git wget curl build-essential cmake pkg-config libssl-dev \
libzmq3-dev libunbound-dev libsodium-dev libunwind8-dev liblzma-dev libreadline6-dev \
libldns-dev libexpat1-dev libpgm-dev qttools5-dev-tools libhidapi-dev libusb-1.0-0-dev \
libprotobuf-dev protobuf-compiler libudev-dev libboost-chrono-dev libboost-date-time-dev \
libboost-filesystem-dev libboost-locale-dev libboost-program-options-dev libboost-regex-dev \
libboost-serialization-dev libboost-system-dev libboost-thread-dev ccache doxygen graphviz -y > /dev/null

RUN sed --help

RUN tar --version && gzip --version

RUN wget https://github.com/libexpat/libexpat/releases/download/R_2_4_8/expat-2.4.8.tar.bz2 && \
    tar -xf expat-2.4.8.tar.bz2 && \
    rm expat-2.4.8.tar.bz2 && \
    cd expat-2.4.8 && \
    ./configure --enable-static --disable-shared && \
    make > /dev/nul && \
    make install > /dev/null

RUN cd /home && \
    wget https://www.nlnetlabs.nl/downloads/unbound/unbound-1.17.0.tar.gz && \
    tar xzf unbound-1.17.0.tar.gz && \
    apt update && \
    apt-get install -y bison && \
    apt-get install -y flex && \
    cd unbound-1.17.0 && \
    ./configure --with-libexpat=/usr --with-ssl=/usr && \
    make > /dev/nul && \
    make install > /dev/null && \
    cd ../

RUN git clone --recursive https://github.com/emscripten-core/emsdk.git > /dev/null && \
    cd /home/emsdk && \
    ./emsdk install 3.1.0 > /dev/null && \
    ./emsdk activate 3.1.0 > /dev/null

COPY . ./monero-javascript

VOLUME /home/monero-javascript

RUN cd /home/monero-javascript && \
    ./bin/update_submodules.sh && \
    cd external/monero-cpp/external/monero-project/ && \
    git apply /home/monero-javascript/monero-patch.diff


RUN source /home/emsdk/emsdk_env.sh && \
    export EMSCRIPTEN="/home/emsdk/upstream/emscripten" && \
    cd /home/monero-javascript && \
    ./bin/build_all.sh > /dev/null

# the call to find is necessary to only hash the files that are meant to be inserted in the npm package. See the "files" section of package.json
# the call to awk is necessary because sha256 produces "<hash> <filename>". We instead want "<filename> <hash>"
# the call to sort is necessary to deterministically sort by "filename".
RUN cd /home/monero-javascript && \
    export INTEGRITY_HASH=$(find ./src ./dist ./package.json ./index.js ./webpack* -type f -exec sha256sum {} \; | awk '{ print $2 " " $1 }' | sort -k1 | sha256sum) && \
    echo "Integrity Hash: ${INTEGRITY_HASH}"
